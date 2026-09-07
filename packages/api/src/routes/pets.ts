import fs from 'fs';
import { Router } from 'express';
import multer from 'multer';
import { dbService, getDb } from '../db';
import {
  MAX_PET_PHOTO_BYTES,
  mimeFromPetPhotoKey,
  resolvePetPhotoPath,
  savePetPhoto,
} from '../services/pet-photo-store';
import {
  fetchTelegramFileBytes,
  looksLikeTelegramFileId,
  materializePetTelegramPhoto,
  petPhotoStorageKeyFromUrl,
  readLocalPetPhoto,
} from '../services/telegram-media';

export const petsRouter = Router();

const petPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PET_PHOTO_BYTES, files: 1 },
});

/** Upload a pet profile photo (multipart field: `file`). Returns a public URL path. */
petsRouter.post('/photos/upload', (req, res) => {
  petPhotoUpload.single('file')(req, res, (uploadErr) => {
    if (uploadErr) {
      const tooLarge =
        uploadErr instanceof multer.MulterError && uploadErr.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)'
          : 'آپلود عکس ناموفق بود',
      });
      return;
    }

    const ownerId = Number(
      (req.body as { ownerId?: string })?.ownerId ?? req.query.ownerId
    );
    const file = req.file;

    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      res.status(400).json({ error: 'ownerId الزامی است' });
      return;
    }
    if (!file?.buffer?.length) {
      res.status(400).json({ error: 'فایل عکس الزامی است' });
      return;
    }

    const owner = dbService.getUserById(ownerId);
    if (!owner) {
      res.status(404).json({ error: 'صاحب پت پیدا نشد' });
      return;
    }

    try {
      const saved = savePetPhoto({
        ownerId,
        originalName: file.originalname || 'pet.jpg',
        mimeType: file.mimetype,
        buffer: file.buffer,
      });
      res.status(201).json({
        ok: true,
        url: saved.urlPath,
        storageKey: saved.storageKey,
        mimeType: file.mimetype,
      });
    } catch (err) {
      if (err instanceof Error && err.message === 'FILE_TOO_LARGE') {
        res.status(413).json({ error: 'حجم عکس بیش از حد مجاز است (حداکثر ۸ مگابایت)' });
        return;
      }
      if (err instanceof Error && err.message === 'INVALID_MIME') {
        res.status(400).json({ error: 'فقط عکس (JPG، PNG، WebP، GIF) مجاز است' });
        return;
      }
      console.warn('pet photo upload failed:', (err as Error).message);
      res.status(500).json({ error: 'ذخیره عکس ناموفق بود' });
    }
  });
});

/** Serve an uploaded pet photo by storage key `ownerId/filename`. */
petsRouter.get('/photos/:ownerId/:filename', (req, res) => {
  const ownerId = String(req.params.ownerId || '');
  const filename = String(req.params.filename || '');
  const storageKey = `${ownerId}/${filename}`;
  const abs = resolvePetPhotoPath(storageKey);
  if (!abs || !fs.existsSync(abs)) {
    res.status(404).json({ error: 'عکس پیدا نشد' });
    return;
  }
  res.setHeader('Content-Type', mimeFromPetPhotoKey(storageKey));
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(fs.readFileSync(abs));
});

petsRouter.get('/', (req, res) => {
  const ownerId = req.query.ownerId ? Number(req.query.ownerId) : undefined;
  const excludeOwnerId = req.query.excludeOwnerId ? Number(req.query.excludeOwnerId) : undefined;
  const species = typeof req.query.species === 'string' ? req.query.species : undefined;
  const city = typeof req.query.city === 'string' ? req.query.city : undefined;
  const province = typeof req.query.province === 'string' ? req.query.province : undefined;
  const breed = typeof req.query.breed === 'string' ? req.query.breed : undefined;
  const lookingForPlaymate =
    req.query.lookingForPlaymate === 'true'
      ? true
      : req.query.lookingForPlaymate === 'false'
        ? false
        : undefined;

  const pets = dbService.listPets({
    ownerId,
    excludeOwnerId,
    lookingForPlaymate,
    species,
    city,
    province,
    breed,
  });
  res.json(pets);
});

petsRouter.get('/:id', (req, res) => {
  const pet = dbService.getPet(Number(req.params.id));
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  res.json(pet);
});

/**
 * Stream pet photo for web <img>.
 * Local `/api/pets/photos/...` is served from disk; Telegram file_id is
 * materialized into pet-photos (best effort) or proxied once.
 */
petsRouter.get('/:id/image', async (req, res) => {
  const petId = Number(req.params.id);
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر است' });
    return;
  }

  const row = getDb()
    .prepare('SELECT id, owner_id, image_url FROM pets WHERE id = ?')
    .get(petId) as { id: number; owner_id: number; image_url: string | null } | undefined;
  if (!row) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }

  const raw = String(row.image_url ?? '').trim();
  if (!raw) {
    res.status(404).json({ error: 'عکس پیدا نشد' });
    return;
  }

  const sendLocal = (urlPath: string): boolean => {
    const key = petPhotoStorageKeyFromUrl(urlPath);
    if (!key) return false;
    const local = readLocalPetPhoto(key);
    if (!local) return false;
    res.setHeader('Content-Type', local.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(local.buffer);
    return true;
  };

  // Already a local pet-photos URL
  if (raw.startsWith('/api/pets/photos/') && sendLocal(raw)) return;

  // Absolute http(s) — redirect
  if (/^https?:\/\//i.test(raw)) {
    res.redirect(302, raw);
    return;
  }

  // Telegram file_id — materialize then stream, or proxy
  if (looksLikeTelegramFileId(raw)) {
    const saved = await materializePetTelegramPhoto(petId, row.owner_id, raw);
    if (saved && sendLocal(saved)) return;

    const bytes = await fetchTelegramFileBytes(raw);
    if (!bytes) {
      res.status(404).json({ error: 'عکس تلگرام در دسترس نیست' });
      return;
    }
    res.setHeader('Content-Type', bytes.contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(bytes.buffer);
    return;
  }

  // Other relative API paths under /api/pets/photos may still work
  if (sendLocal(raw)) return;

  res.status(404).json({ error: 'عکس پیدا نشد' });
});

petsRouter.post('/', (req, res) => {
  const {
    ownerId,
    name,
    species,
    breed,
    gender,
    ageMonths,
    size,
    color,
    bio,
    vaccinated,
    neutered,
    lookingForPlaymate,
    personality,
    health,
    diseases,
    imageUrl,
    city,
    neighborhood,
  } = req.body;

  if (!ownerId || !name || !species) {
    res.status(400).json({ error: 'ownerId، name و species الزامی هستند' });
    return;
  }

  const owner = dbService.getUserById(Number(ownerId));
  if (!owner) {
    res.status(404).json({ error: 'صاحب پت پیدا نشد' });
    return;
  }

  const healthPayload =
    health && typeof health === 'object'
      ? { ...health }
      : {};
  if (typeof diseases === 'string' && diseases.trim()) {
    healthPayload.diseases = diseases.trim();
  }

  const pet = dbService.createPet({
    ownerId: Number(ownerId),
    name,
    species,
    breed,
    gender,
    ageMonths,
    size,
    color,
    bio,
    vaccinated,
    neutered,
    lookingForPlaymate,
    personality,
    health: healthPayload,
    imageUrl,
    city,
    neighborhood,
  });

  // Bot stores Telegram file_id in imageUrl — materialize in background for web <img>
  const rawImage = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  if (rawImage && looksLikeTelegramFileId(rawImage)) {
    void materializePetTelegramPhoto(pet.id, pet.ownerId, rawImage).catch((err) => {
      console.warn('background pet photo materialize failed:', (err as Error).message);
    });
  }

  dbService.setUserOnboarding(Number(ownerId), 'profile_complete');
  res.status(201).json(pet);
});

petsRouter.patch('/:id', (req, res) => {
  const petId = Number(req.params.id);
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر است' });
    return;
  }

  const existing = dbService.getPet(petId);
  if (!existing) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }

  const ownerId = req.query.ownerId
    ? Number(req.query.ownerId)
    : req.body?.ownerId
      ? Number(req.body.ownerId)
      : undefined;
  if (ownerId !== undefined && existing.ownerId !== ownerId) {
    res.status(403).json({ error: 'اجازه ویرایش این پت را نداری' });
    return;
  }

  const body = { ...req.body };
  delete body.ownerId;
  if (typeof body.diseases === 'string') {
    body.health = {
      ...existing.health,
      ...(body.health && typeof body.health === 'object' ? body.health : {}),
      diseases: body.diseases.trim() || undefined,
    };
    delete body.diseases;
  }

  const pet = dbService.updatePet(petId, body);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }

  const patchedImage =
    typeof body.imageUrl === 'string' ? String(body.imageUrl).trim() : '';
  if (patchedImage && looksLikeTelegramFileId(patchedImage)) {
    void materializePetTelegramPhoto(petId, existing.ownerId, patchedImage).catch((err) => {
      console.warn('background pet photo materialize failed:', (err as Error).message);
    });
  }

  res.json(pet);
});

petsRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const ownerId = req.query.ownerId
    ? Number(req.query.ownerId)
    : req.body?.ownerId
      ? Number(req.body.ownerId)
      : undefined;

  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'شناسه پت نامعتبر است' });
    return;
  }

  const existing = dbService.getPet(id);
  if (!existing) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }

  if (ownerId !== undefined && existing.ownerId !== ownerId) {
    res.status(403).json({ error: 'اجازه حذف این پت را نداری' });
    return;
  }

  const ok = dbService.deletePet(id, ownerId);
  if (!ok) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  res.json({ ok: true, id });
});

petsRouter.get('/:id/medical-record', (req, res) => {
  const petId = Number(req.params.id);
  const viewerId = req.query.viewerId ? Number(req.query.viewerId) : undefined;
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر' });
    return;
  }
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (viewerId == null || !Number.isFinite(viewerId)) {
    res.status(401).json({ error: 'viewerId الزامی است' });
    return;
  }
  const access = dbService.canAccessPetMedical(petId, viewerId);
  if (!access.ok) {
    res.status(403).json({ error: 'دسترسی به پرونده نداری' });
    return;
  }
  const record = dbService.getPetMedicalRecord(petId);
  const entries = dbService.listPetMedicalEntries(petId);
  const prescriptions = dbService.listPrescriptionsForPet(petId, 30);
  res.json({ record, entries, prescriptions, pet });
});

petsRouter.get('/:id/prescriptions', (req, res) => {
  const petId = Number(req.params.id);
  const viewerId = req.query.viewerId ? Number(req.query.viewerId) : undefined;
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر' });
    return;
  }
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (viewerId == null || !Number.isFinite(viewerId)) {
    res.status(401).json({ error: 'viewerId الزامی است' });
    return;
  }
  const access = dbService.canAccessPetMedical(petId, viewerId);
  if (!access.ok) {
    res.status(403).json({ error: 'دسترسی به نسخه‌ها نداری' });
    return;
  }
  res.json(dbService.listPrescriptionsForPet(petId, 40));
});

petsRouter.get('/:id/wishlist', (req, res) => {
  const petId = Number(req.params.id);
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر' });
    return;
  }
  if (!dbService.getPet(petId)) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  res.json(dbService.listPetWishlist(petId));
});

petsRouter.post('/:id/wishlist', (req, res) => {
  const petId = Number(req.params.id);
  const targetPetId = Number(req.body?.targetPetId);
  const ownerId = Number(req.body?.ownerId);
  if (!Number.isFinite(petId) || !Number.isFinite(targetPetId)) {
    res.status(400).json({ error: 'شناسه نامعتبر' });
    return;
  }
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (Number.isFinite(ownerId) && pet.ownerId !== ownerId) {
    res.status(403).json({ error: 'فقط صاحب پت می‌تواند ویش‌لیست را تغییر دهد' });
    return;
  }
  const result = dbService.addPetWishlist(petId, targetPetId);
  if (!result.ok) {
    res.status(400).json({
      error:
        result.reason === 'self'
          ? 'نمی‌توانی پت را به ویش‌لیست خودش اضافه کنی'
          : 'پت پیدا نشد',
    });
    return;
  }
  res.status(result.created ? 201 : 200).json({ ok: true, created: result.created });
});

petsRouter.delete('/:id/wishlist/:targetPetId', (req, res) => {
  const petId = Number(req.params.id);
  const targetPetId = Number(req.params.targetPetId);
  const ownerId = req.query.ownerId ? Number(req.query.ownerId) : undefined;
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (ownerId != null && pet.ownerId !== ownerId) {
    res.status(403).json({ error: 'اجازه نداری' });
    return;
  }
  dbService.removePetWishlist(petId, targetPetId);
  res.json({ ok: true });
});

petsRouter.put('/:id/medical-record', (req, res) => {
  const petId = Number(req.params.id);
  const viewerId = req.body?.viewerId != null ? Number(req.body.viewerId) : undefined;
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر' });
    return;
  }
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  if (viewerId == null) {
    res.status(400).json({ error: 'viewerId الزامی است' });
    return;
  }
  const access = dbService.canAccessPetMedical(petId, viewerId, { write: true });
  if (!access.ok) {
    res.status(403).json({ error: 'دسترسی به پرونده نداری' });
    return;
  }
  const patch = {
    notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
    vaccinations: typeof req.body?.vaccinations === 'string' ? req.body.vaccinations : undefined,
    allergies: typeof req.body?.allergies === 'string' ? req.body.allergies : undefined,
    chronicConditions:
      typeof req.body?.chronicConditions === 'string' ? req.body.chronicConditions : undefined,
    lastCheckup: typeof req.body?.lastCheckup === 'string' ? req.body.lastCheckup : undefined,
    medications: typeof req.body?.medications === 'string' ? req.body.medications : undefined,
  };
  const authorUser = dbService.getUserById(viewerId);
  const consultId =
    req.body?.consultId != null && Number.isFinite(Number(req.body.consultId))
      ? Number(req.body.consultId)
      : undefined;
  const record = dbService.upsertPetMedicalRecord(petId, patch, {
    userId: viewerId,
    name: authorUser?.name,
    consultId,
    appendEntries: true,
  });
  res.json(record);
});

petsRouter.post('/:id/medical-entries', (req, res) => {
  const petId = Number(req.params.id);
  const authorUserId = req.body?.authorUserId != null ? Number(req.body.authorUserId) : undefined;
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  const consultId = req.body?.consultId != null ? Number(req.body.consultId) : undefined;
  const authorName =
    typeof req.body?.authorName === 'string' ? req.body.authorName.trim() : undefined;
  if (!Number.isFinite(petId) || petId <= 0) {
    res.status(400).json({ error: 'شناسه پت نامعتبر' });
    return;
  }
  if (!authorUserId || !text) {
    res.status(400).json({ error: 'authorUserId و text الزامی هستند' });
    return;
  }
  const pet = dbService.getPet(petId);
  if (!pet) {
    res.status(404).json({ error: 'پت پیدا نشد' });
    return;
  }
  const access = dbService.canAccessPetMedical(petId, authorUserId, { write: true });
  if (!access.ok) {
    res.status(403).json({ error: 'اجازه ثبت در پرونده را نداری' });
    return;
  }
  const entry = dbService.addPetMedicalEntry({
    petId,
    authorUserId,
    authorName,
    text,
    consultId: Number.isFinite(consultId) ? consultId : undefined,
  });
  res.status(201).json(entry);
});
