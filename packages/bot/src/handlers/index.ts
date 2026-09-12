import type { Bot, Context } from 'grammy';
import type { PetGender, PetSize, UserGender, UserRole } from '@petdate/shared';
import { ROLE_CONFIRM_LABEL, USER_ROLE_LABELS, USER_ROLES } from '@petdate/shared';
import { forceJoinMiddleware, missingChannels, safeAnswerCallback, sendForceJoinPrompt } from '../force-join';
import {
  MENU_LABELS,
  MAIN_MENU_ALIASES,
  MAIN_MENU_BTN,
  PET_OWNER_MENU,
  DEFAULT_MENU,
  NO_PET_MENU,
  PET_SEEKER_MENU,
  VET_MENU,
  TRAINER_MENU,
  SITTER_MENU,
  ADMIN_MENU,
  MY_PETS_SECTION,
  SEARCH_PETS_MENU,
  WIZARD_NAV,
  mainMenuKeyboard,
  nearbyLocationKeyboard,
} from '../keyboards';
import { getSession, upsertSession } from '../session';
import { handleExplore, handleExploreBack, handleExploreForPet, handleExplorePet, handleExplorePickPet, handleFindPlaymate } from './explore';
import {
  handleAddPetCommand,
  handleBreedCustom,
  handleBreedSelect,
  handlePetBoolSelect,
  handlePetGenderSelect,
  handlePetPhoto,
  handlePetSizeSelect,
  handleSpeciesSelect,
  handleWizardSkip,
  handleWizardText,
} from './wizard';
import {
  handleMyPetDeleteAsk,
  handleMyPetDeleteConfirm,
  handleMyPetView,
  handleMyPets,
  handlePlaydateAction,
  handlePlaydateAsk,
  handlePlaydateCancel,
  handlePlaydateFrom,
  handlePlaydateOwnerProfile,
  handlePlaydateResend,
  handlePlaydateSend,
  handleRequests,
} from './playdates';
import {
  handlePetEditPhoto,
  handlePetEditText,
  showPetEditMenu,
  startPetSectionEdit,
  type PetEditField,
} from './pet-edit';
import {
  handleProfile,
  handleProfileAccountMenu,
  handleProfileBlocked,
  handleProfileContact,
  handleProfileContacts,
  handleProfileDeactivateAsk,
  handleProfileDeactivateConfirm,
  handleProfileDeleteAsk,
  handleProfileDeleteConfirm,
  handleProfileActivate,
  handleProfileGender,
  handleProfileInteractions,
  handleProfileLikes,
  handleProfilePhoto,
  handleProfileSilentToggle,
  handleProfileSkip,
  handleProfileWizardText,
  handleUserCommandId,
  handleVetCredentialDocument,
  handleVetCredentialPhoto,
  handleVetCredentialText,
  showProfileEditMenu,
  showPublicUserById,
  startProfileSectionEdit,
  startProfileWizard,
  startVetCredentialUpload,
} from './profile';
import {
  handleCancel,
  handleHelp,
  handleMenu,
  handleMyRoles,
  handleMyRolesAdd,
  handleMyRolesSwitch,
  handleRoleConfirm,
  handleRoleSelect,
  handleStart,
  handleWebPendingLoginConfirm,
  getCtxUser,
} from './start';
import { menuKeyboardFor } from './helpers';
import { handleSupportChat, handleSupportChatText, handleSupportChatVoice, handleSupportMenu, handleSupportTicketStart } from './support';
import {
  handleComingSoon,
  handleChatsEntry,
  handleInviteFriends,
  handleQuickVet,
  handleQuickVetConnect,
  handleQuickVetReconnect,
  handleServices,
  handleVetConsultDecision,
  handleVetConsultPatientProfile,
} from './services';
import {
  handleBuyPetConsult,
  handleBuyPetConsultConnect,
  handlePetsAndPlaymates,
  handleReadyToAdoptToggle,
} from './role-menus';
import {
  handlePetShop,
  handleShopBackCategories,
  handleShopBuy,
  handleShopBuyStars,
  handleShopCategory,
  handleShopCheckoutText,
  handleShopFeatured,
  handleShopHome,
  handleShopNoop,
  handleShopOrders,
  handleShopPage,
  handleShopPay,
  handleShopPayStars,
  handleShopPetType,
  handleShopSetPayMethod,
  handleShopView,
} from './shop';
import {
  handleVetChatMedicalPetPick,
  handleVetChatNotePetPick,
  handleVetChatPetProfilePetPick,
  handleVetChatPrescriptionPetPick,
  handleVetChatRelay,
  handleVetChatRxCategory,
  handleVetChatRxConfirm,
  handleVetChatRxManual,
  handleVetChatRxMedPick,
  handleVetChatRxMore,
  handleSecureWipeVetCallback,
} from './vet-chat';
import {
  enterOwnerChatFromCallback,
  handleOwnerChatRelay,
  handleSecureWipePlaydateCallback,
} from './owner-chat';
import {
  handlePatientChatInvite,
  handleVetOnlineToggle,
  handleVetRecentPatients,
  handleVetRequestRechat,
  handleVetVisitFeeCustomPrompt,
  handleVetVisitFeeMenu,
  handleVetVisitFeePick,
  handleVetVisitFeeText,
} from './vet';
import {
  handleCoins,
  handleCoinsBack,
  handleCoinsDaily,
  handleCoinsDailyDone,
  handleCoinsTransactions,
  handleCoinsPackage,
  handleCoinsPay,
  handleCoinsPayCancel,
  handleCoinsSendReceiptPrompt,
  CANCEL_PAYMENT_BTN,
  SEND_RECEIPT_BTN,
  handleEarn,
  handleEarnCancel,
  handleEarnCardText,
  handleEarnClose,
  handleEarnConfirm,
  handleEarnSell,
  handlePaymentApprove,
  handlePaymentReceiptPhoto,
  handlePaymentReject,
  handlePreCheckout,
  handleSuccessfulPayment,
  handleWalletStarsTopUpBuy,
  handleWalletStarsTopUpMenu,
} from './coins';
import {
  handleNearbyListCallback,
  handleNearbyLocationMessage,
  handleNearbyPets,
  handleNearbyPickRadiusCallback,
  handleNearbyRadiusCallback,
  handleNearbySummaryCallback,
  handleSearchAll,
  handleSearchBreedText,
  handleSearchByBreedStart,
  handleSearchGoCallback,
  handleSearchHomeCallback,
  handleSearchMashhad,
  handleSearchMenuCallback,
  handleSearchNearbyAskLocCallback,
  handleSearchNewest,
  handleSearchOwnerView,
  handleSearchPage,
  handleSearchPetsMenu,
  handleSearchPetView,
  handleSearchPopular,
  handleSearchSameBreed,
  handleSearchSameProvince,
} from './search';
import {
  handleAdminApprove,
  handleAdminRejectAsk,
  handleAdminRejectReasonText,
  handleAdminRejectSkip,
  handleAdminVerifyNext,
  handleAdminVerifyQueue,
  handleVerifyCancel,
  handleVerifyPhoto,
  handleVerifyStart,
  handleVerifyStatus,
  handleVerifyUseAvatar,
  handleVerifyVideo,
} from './verification';
import {
  handleAdminEntry,
  handleAdminMenuText,
  handleAdminPasswordText,
  handleAdminPetPhotoAction,
  handleAdminPetPhotoQueue,
  handleAdminUserAvatarAction,
  handleAdminUserAvatarQueue,
  handleAdminProviderCredentialAction,
  handleAdminProviderCredentialQueue,
  handleAdminVetCredentialApprove,
  handleAdminVetCredentialNext,
  handleAdminVetCredentialQueue,
  handleAdminVetCredentialReject,
  handleAdminVetList,
  handleAdminVetToggle,
  handleAdminVetView,
} from './admin';
import {
  handleProviderCredentialPhoto,
  handleProviderCredentialStart,
  handleProviderOnlineToggle,
  handleProviderRecentClients,
  handleRequestSeekerAdvice,
  handleRequestSitter,
  handleRequestTrainer,
  handleToggleSeekerAdvice,
} from './marketplace';
import {
  ensureVetPhoneVerified,
  handlePhoneVerifyContact,
  handlePhoneVerifyStart,
  handlePhoneVerifyText,
} from './phone-verify';
import { touchTelegramPresence } from '../api-client';
import { stickyReplyKeyboardMiddleware } from '../sticky-reply-keyboard';
import { registerBusinessHandlers } from './business';

export function registerHandlers(bot: Bot): void {
  // قبل از force-join: آپدیت Business connection نباید بلاک شود
  registerBusinessHandlers(bot);

  // کیبورد reply باید روی پیام محتوا بماند — sticky send+delete کیبورد را پاک می‌کند
  bot.use(stickyReplyKeyboardMiddleware());
  // عضویت اجباری در کانال‌ها — قبل از همهٔ دستورات
  bot.use(forceJoinMiddleware);

  // Heartbeat آنلاین بودن برای کاربرانی که در ربات فعال‌اند
  bot.use(async (ctx, next) => {
    const tid = ctx.from?.id;
    if (tid) void touchTelegramPresence(String(tid));
    await next();
  });

  bot.callbackQuery('join:check', async (ctx) => {
    try {
      const { missing } = await missingChannels(ctx);
      if (missing.length === 0) {
        await safeAnswerCallback(ctx, { text: 'عضویت تأیید شد ✅' });
        try {
          await ctx.editMessageText('✅ عضویت تأیید شد. خوش اومدی!');
        } catch {
          /* ignore */
        }
        await handleStart(ctx);
        return;
      }
      await safeAnswerCallback(ctx, {
        text: 'هنوز عضو کانال نشدی',
        show_alert: true,
      });
      await sendForceJoinPrompt(ctx, missing);
    } catch (err) {
      console.error('join:check failed:', err);
      await safeAnswerCallback(ctx, { text: 'خطا — دوباره /start بزن', show_alert: true });
    }
  });

  bot.command('start', handleStart);
  bot.command('menu', handleMenu);
  bot.command('help', handleHelp);

  // Tappable public ids: /u00042 (hyphen-free; Telegram bot_command charset)
  bot.hears(/^\/u_?\d{1,10}(?:@\w+)?(?:\s|$)/i, (ctx) => handleUserCommandId(ctx));

  bot.callbackQuery(/^wpend:(ok|no):([a-f0-9]{32})$/i, async (ctx) => {
    const accept = String(ctx.match![1]).toLowerCase() === 'ok';
    const pendingId = String(ctx.match![2]).toLowerCase();
    await handleWebPendingLoginConfirm(ctx, pendingId, accept);
  });

  bot.command('cancel', handleCancel);
  bot.command('explore', (ctx) => handleFindPlaymate(ctx));
  bot.command('pets', handleMyPets);
  bot.command('requests', handleRequests);
  bot.command('profile', handleProfile);
  bot.command('addpet', handleAddPetCommand);
  bot.command('admin', handleAdminEntry);
  bot.command('verify', handleAdminVerifyQueue);

  bot.callbackQuery('role:confirm', async (ctx) => {
    try {
      await handleRoleConfirm(ctx);
    } catch (err) {
      console.error('Role confirm failed:', err);
      await ctx.answerCallbackQuery({ text: 'خطا. دوباره /start بزن.', show_alert: true });
    }
  });

  bot.callbackQuery('myroles:add', async (ctx) => {
    try {
      await handleMyRolesAdd(ctx);
    } catch (err) {
      console.error('My roles add failed:', err);
      await ctx.answerCallbackQuery({ text: 'خطا', show_alert: true }).catch(() => undefined);
    }
  });

  bot.callbackQuery(/^myroles:switch:(.+)$/, async (ctx) => {
    try {
      const role = ctx.match![1] as UserRole;
      if (!USER_ROLES.includes(role)) {
        await ctx.answerCallbackQuery({ text: 'نقش نامعتبر', show_alert: true });
        return;
      }
      await handleMyRolesSwitch(ctx, role);
    } catch (err) {
      console.error('My roles switch failed:', err);
      await ctx.answerCallbackQuery({ text: 'خطا', show_alert: true }).catch(() => undefined);
    }
  });

  bot.callbackQuery(/^role:(.+)$/, async (ctx) => {
    try {
      const role = ctx.match![1] as UserRole;
      if (!USER_ROLES.includes(role)) {
        await ctx.answerCallbackQuery({ text: 'نقش نامعتبر', show_alert: true });
        return;
      }
      await handleRoleSelect(ctx, role);
    } catch (err) {
      console.error('Role selection failed:', err);
      await ctx.answerCallbackQuery({ text: 'خطا. دوباره /start بزن.', show_alert: true });
    }
  });

  bot.callbackQuery(/^species:(.+)$/, (ctx) => handleSpeciesSelect(ctx, ctx.match![1]!));
  bot.callbackQuery(/^breed:(\d+)$/, (ctx) => handleBreedSelect(ctx, Number(ctx.match![1])));
  bot.callbackQuery('breed:custom', (ctx) => handleBreedCustom(ctx));
  bot.callbackQuery(/^pet:gender:(male|female)$/, (ctx) =>
    handlePetGenderSelect(ctx, ctx.match![1] as PetGender)
  );
  bot.callbackQuery(/^pet:size:(small|medium|large)$/, (ctx) =>
    handlePetSizeSelect(ctx, ctx.match![1] as PetSize)
  );
  bot.callbackQuery(/^pet:bool:(vaccinated|neutered|looking):(0|1)$/, (ctx) =>
    handlePetBoolSelect(ctx, ctx.match![1] as 'vaccinated' | 'neutered' | 'looking', ctx.match![2] === '1')
  );

  bot.callbackQuery('wizard:skip_breed', (ctx) => handleWizardSkip(ctx, 'breed'));
  bot.callbackQuery('wizard:skip_color', (ctx) => handleWizardSkip(ctx, 'color'));
  bot.callbackQuery('wizard:skip_diseases', (ctx) => handleWizardSkip(ctx, 'diseases'));
  bot.callbackQuery('wizard:skip_bio', (ctx) => handleWizardSkip(ctx, 'bio'));
  bot.callbackQuery('wizard:skip_photo', (ctx) => handleWizardSkip(ctx, 'photo'));
  bot.callbackQuery('noop', (ctx) => ctx.answerCallbackQuery());

  bot.callbackQuery(/^explore:page:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleExplore(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(/^explore:pet:(\d+)$/, (ctx) => handleExplorePet(ctx, Number(ctx.match![1])));
  bot.callbackQuery('explore:back', handleExploreBack);
  bot.callbackQuery('explore:pick', (ctx) => handleExplorePickPet(ctx));
  bot.callbackQuery('explore:for:all', (ctx) => handleExploreForPet(ctx, 'all'));
  bot.callbackQuery(/^explore:for:(\d+)$/, (ctx) =>
    handleExploreForPet(ctx, Number(ctx.match![1]))
  );

  bot.callbackQuery(/^playdate:ask:(\d+)$/, (ctx) => handlePlaydateAsk(ctx, Number(ctx.match![1])));
  bot.callbackQuery(/^playdate:from:(\d+):(\d+)$/, (ctx) =>
    handlePlaydateFrom(ctx, Number(ctx.match![1]), Number(ctx.match![2]))
  );
  bot.callbackQuery(/^playdate:send:(\d+):(\d+)$/, (ctx) =>
    handlePlaydateSend(ctx, Number(ctx.match![1]), Number(ctx.match![2]))
  );
  bot.callbackQuery(/^playdate:resend:(\d+):(\d+)$/, (ctx) =>
    handlePlaydateResend(ctx, Number(ctx.match![1]), Number(ctx.match![2]))
  );
  bot.callbackQuery(/^playdate:accept:(\d+)$/, (ctx) =>
    handlePlaydateAction(ctx, Number(ctx.match![1]), 'accept')
  );
  bot.callbackQuery(/^playdate:reject:(\d+)$/, (ctx) =>
    handlePlaydateAction(ctx, Number(ctx.match![1]), 'reject')
  );
  bot.callbackQuery(/^playdate:owner:(\d+)$/, (ctx) =>
    handlePlaydateOwnerProfile(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^playdate:enterchat:(\d+)$/, (ctx) =>
    enterOwnerChatFromCallback(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery('playdate:cancel', handlePlaydateCancel);

  bot.callbackQuery('pets:add', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      /* ignore */
    }
    await handleAddPetCommand(ctx);
  });
  bot.callbackQuery('pets:list', async (ctx) => {
    try {
      await ctx.answerCallbackQuery();
    } catch {
      /* ignore */
    }
    await handleMyPets(ctx);
  });
  bot.callbackQuery(/^pets:view:(\d+)$/, (ctx) =>
    handleMyPetView(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^pets:edit:(\d+):back$/, async (ctx) => {
    const petId = Number(ctx.match![1]);
    try {
      await ctx.answerCallbackQuery();
    } catch {
      /* ignore */
    }
    if (ctx.from) {
      await upsertSession(String(ctx.from.id), {
        step: 'ready',
        petSectionEdit: false,
        selectedPetId: undefined,
        draftPet: undefined,
        breedPage: undefined,
      });
    }
    await handleMyPetView(ctx, petId);
  });
  bot.callbackQuery(
    /^pets:edit:(\d+):(name|species|age|gender|size|color|photo|bio|vaccinated|neutered|looking|diseases)$/,
    (ctx) =>
      startPetSectionEdit(ctx, Number(ctx.match![1]), ctx.match![2] as PetEditField)
  );
  bot.callbackQuery(/^pets:edit:(\d+)$/, (ctx) => showPetEditMenu(ctx, Number(ctx.match![1])));
  bot.callbackQuery(/^pets:delete:yes:(\d+)$/, (ctx) =>
    handleMyPetDeleteConfirm(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^pets:delete:(\d+)$/, (ctx) =>
    handleMyPetDeleteAsk(ctx, Number(ctx.match![1]))
  );

  bot.callbackQuery('profile:edit', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showProfileEditMenu(ctx);
  });
  bot.callbackQuery('profile:edit:back', async (ctx) => {
    await ctx.answerCallbackQuery();
    await handleProfile(ctx);
  });
  bot.callbackQuery('profile:edit:all', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startProfileWizard(ctx);
  });
  bot.callbackQuery('profile:edit:name', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startProfileSectionEdit(ctx, 'name');
  });
  bot.callbackQuery('profile:edit:age', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startProfileSectionEdit(ctx, 'age');
  });
  bot.callbackQuery('profile:edit:gender', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startProfileSectionEdit(ctx, 'gender');
  });
  bot.callbackQuery('profile:edit:location', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startProfileSectionEdit(ctx, 'location');
  });
  bot.callbackQuery('profile:edit:phone', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startProfileSectionEdit(ctx, 'phone');
  });
  bot.callbackQuery('profile:edit:photo', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startProfileSectionEdit(ctx, 'photo');
  });
  bot.callbackQuery('profile:edit:bio', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startProfileSectionEdit(ctx, 'bio');
  });
  bot.callbackQuery('profile:edit:interests', async (ctx) => {
    await ctx.answerCallbackQuery();
    await startProfileSectionEdit(ctx, 'interests');
  });
  bot.callbackQuery('profile:vet_credential', async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!(await ensureVetPhoneVerified(ctx))) return;
    await startVetCredentialUpload(ctx);
  });
  bot.callbackQuery(/^profile:gender:(male|female)$/, (ctx) =>
    handleProfileGender(ctx, ctx.match![1] as UserGender)
  );
  bot.callbackQuery('profile:skip_phone', (ctx) => handleProfileSkip(ctx, 'phone'));
  bot.callbackQuery('profile:skip_photo', (ctx) => handleProfileSkip(ctx, 'photo'));
  bot.callbackQuery('profile:skip_bio', (ctx) => handleProfileSkip(ctx, 'bio'));
  bot.callbackQuery('profile:likes', (ctx) => handleProfileLikes(ctx));
  bot.callbackQuery('profile:contacts', (ctx) => handleProfileContacts(ctx));
  bot.callbackQuery('profile:interactions', (ctx) => handleProfileInteractions(ctx));
  bot.callbackQuery('profile:blocked', (ctx) => handleProfileBlocked(ctx));
  bot.callbackQuery('profile:silent', (ctx) => handleProfileSilentToggle(ctx));
  bot.callbackQuery('profile:account', (ctx) => handleProfileAccountMenu(ctx));
  bot.callbackQuery('profile:deactivate', (ctx) => handleProfileDeactivateAsk(ctx));
  bot.callbackQuery('profile:activate', async (ctx) => {
    if (!(await ensureVetPhoneVerified(ctx))) return;
    await handleProfileActivate(ctx);
  });
  bot.callbackQuery('profile:delete', (ctx) => handleProfileDeleteAsk(ctx));
  bot.callbackQuery('profile:deactivate:yes', (ctx) => handleProfileDeactivateConfirm(ctx, true));
  bot.callbackQuery('profile:deactivate:no', (ctx) => handleProfileDeactivateConfirm(ctx, false));
  bot.callbackQuery('profile:delete:yes', (ctx) => handleProfileDeleteConfirm(ctx, true));
  bot.callbackQuery('profile:delete:no', (ctx) => handleProfileDeleteConfirm(ctx, false));

  bot.callbackQuery('verify:start', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleVerifyStart(ctx);
  });
  bot.callbackQuery('verify:status', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleVerifyStatus(ctx);
  });
  bot.callbackQuery('verify:use_avatar', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleVerifyUseAvatar(ctx);
  });
  bot.callbackQuery('verify:cancel', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleVerifyCancel(ctx);
  });
  bot.callbackQuery('verify:admin:queue', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminVerifyQueue(ctx);
  });
  bot.callbackQuery('verify:admin:next', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminVerifyNext(ctx);
  });
  bot.callbackQuery(/^verify:approve:(\d+)$/, (ctx) =>
    handleAdminApprove(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^verify:reject:(\d+)$/, (ctx) =>
    handleAdminRejectAsk(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery('verify:reject_skip', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminRejectSkip(ctx);
  });

  bot.callbackQuery('vetcred:admin:queue', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminVetCredentialQueue(ctx);
  });
  bot.callbackQuery('vetcred:admin:next', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminVetCredentialNext(ctx);
  });
  bot.callbackQuery(/^vetcred:approve:(\d+)$/, (ctx) =>
    handleAdminVetCredentialApprove(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^vetcred:reject:(\d+)$/, (ctx) =>
    handleAdminVetCredentialReject(ctx, Number(ctx.match![1]))
  );

  bot.callbackQuery(/^provcred:admin:queue:(trainer|sitter)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminProviderCredentialQueue(ctx, ctx.match![1] as 'trainer' | 'sitter');
  });
  bot.callbackQuery(/^provcred:admin:next:(trainer|sitter)$/, async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminProviderCredentialQueue(ctx, ctx.match![1] as 'trainer' | 'sitter');
  });
  bot.callbackQuery(/^provcred:approve:(trainer|sitter):(\d+)$/, async (ctx) => {
    await handleAdminProviderCredentialAction(
      ctx,
      ctx.match![1] as 'trainer' | 'sitter',
      Number(ctx.match![2]),
      true
    );
  });
  bot.callbackQuery(/^provcred:reject:(trainer|sitter):(\d+)$/, async (ctx) => {
    await handleAdminProviderCredentialAction(
      ctx,
      ctx.match![1] as 'trainer' | 'sitter',
      Number(ctx.match![2]),
      false
    );
  });

  bot.callbackQuery('petphoto:admin:queue', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminPetPhotoQueue(ctx);
  });
  bot.callbackQuery('petphoto:admin:next', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminPetPhotoQueue(ctx);
  });
  bot.callbackQuery(/^petphoto:approve:(\d+)$/, async (ctx) => {
    await handleAdminPetPhotoAction(ctx, Number(ctx.match![1]), true);
  });
  bot.callbackQuery(/^petphoto:reject:(\d+)$/, async (ctx) => {
    await handleAdminPetPhotoAction(ctx, Number(ctx.match![1]), false);
  });
  bot.callbackQuery('useravatar:admin:queue', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminUserAvatarQueue(ctx);
  });
  bot.callbackQuery('useravatar:admin:next', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handleAdminUserAvatarQueue(ctx);
  });
  bot.callbackQuery(/^useravatar:approve:(\d+)$/, async (ctx) => {
    await handleAdminUserAvatarAction(ctx, Number(ctx.match![1]), true);
  });
  bot.callbackQuery(/^useravatar:reject:(\d+)$/, async (ctx) => {
    await handleAdminUserAvatarAction(ctx, Number(ctx.match![1]), false);
  });

  bot.callbackQuery(/^admin:vet:list:(\d+)$/, async (ctx) => {
    await handleAdminVetList(ctx, Number(ctx.match![1]));
  });
  bot.callbackQuery(/^admin:vet:view:(\d+):(\d+)$/, async (ctx) => {
    await handleAdminVetView(ctx, Number(ctx.match![1]), Number(ctx.match![2]));
  });
  bot.callbackQuery(/^admin:vet:enable:(\d+)(?::(\d+))?$/, async (ctx) => {
    await handleAdminVetToggle(
      ctx,
      Number(ctx.match![1]),
      true,
      ctx.match![2] != null ? Number(ctx.match![2]) : 0
    );
  });
  bot.callbackQuery(/^admin:vet:disable:(\d+)(?::(\d+))?$/, async (ctx) => {
    await handleAdminVetToggle(
      ctx,
      Number(ctx.match![1]),
      false,
      ctx.match![2] != null ? Number(ctx.match![2]) : 0
    );
  });

  bot.callbackQuery('phone:verify:start', async (ctx) => {
    await ctx.answerCallbackQuery().catch(() => undefined);
    await handlePhoneVerifyStart(ctx);
  });

  bot.callbackQuery('support:ticket', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'ثبت تیکت' }).catch(() => undefined);
    await handleSupportTicketStart(ctx);
  });
  bot.callbackQuery('support:agent', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'بات پشتیبانی' }).catch(() => undefined);
    await handleSupportChat(ctx);
  });

  bot.callbackQuery(/^medical:/, (ctx) => handleComingSoon(ctx, 'پزشکی'));
  bot.callbackQuery('vet:connect', (ctx) => handleQuickVetConnect(ctx));
  bot.callbackQuery('vet:connect:resend', (ctx) =>
    handleQuickVetConnect(ctx, { confirmResend: true })
  );
  bot.callbackQuery('vet:buyconsult:connect', (ctx) => handleBuyPetConsultConnect(ctx));
  bot.callbackQuery('vet:buyconsult:resend', (ctx) =>
    handleBuyPetConsultConnect(ctx, { confirmResend: true })
  );
  bot.callbackQuery('vet:connect:cancel', async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'لغو شد' }).catch(() => undefined);
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: { inline_keyboard: [] } });
    } catch {
      /* ignore */
    }
  });
  bot.callbackQuery(/^vet:reconnect:(\d+)$/, (ctx) =>
    handleQuickVetReconnect(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^vet:consult:accept:(\d+)$/, (ctx) =>
    handleVetConsultDecision(ctx, Number(ctx.match![1]), 'accept')
  );
  bot.callbackQuery(/^vet:consult:reject:(\d+)$/, (ctx) =>
    handleVetConsultDecision(ctx, Number(ctx.match![1]), 'reject')
  );
  bot.callbackQuery(/^vet:consult:patient:(\d+)$/, (ctx) =>
    handleVetConsultPatientProfile(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^vet:fee:(\d+)$/, (ctx) =>
    handleVetVisitFeePick(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery('vet:fee:custom', (ctx) => handleVetVisitFeeCustomPrompt(ctx));
  bot.callbackQuery(/^vet:rechat:(\d+)$/, (ctx) =>
    handleVetRequestRechat(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^vet:invite:accept:(\d+)$/, (ctx) =>
    handlePatientChatInvite(ctx, Number(ctx.match![1]), 'accept')
  );
  bot.callbackQuery(/^vet:invite:reject:(\d+)$/, (ctx) =>
    handlePatientChatInvite(ctx, Number(ctx.match![1]), 'reject')
  );
  bot.callbackQuery(/^vet:consult:ack:/, async (ctx) => {
    await ctx.answerCallbackQuery({ text: 'باشه ✅' }).catch(() => undefined);
  });
  bot.callbackQuery(/^vchat:med:(\d+)$/, (ctx) =>
    handleVetChatMedicalPetPick(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^vchat:prof:(\d+)$/, (ctx) =>
    handleVetChatPetProfilePetPick(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^vchat:note:(\d+)$/, (ctx) =>
    handleVetChatNotePetPick(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^vchat:rx:(\d+)$/, (ctx) =>
    handleVetChatPrescriptionPetPick(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^vchat:rxcat:([a-z]+)$/, (ctx) =>
    handleVetChatRxCategory(ctx, ctx.match![1]!)
  );
  bot.callbackQuery(/^vchat:rxmed:([a-z]+):([a-z0-9_]+)$/, (ctx) =>
    handleVetChatRxMedPick(ctx, ctx.match![1]!, ctx.match![2]!)
  );
  bot.callbackQuery('vchat:rxmore', (ctx) => handleVetChatRxMore(ctx));
  bot.callbackQuery('vchat:rxmanual', (ctx) => handleVetChatRxManual(ctx));
  bot.callbackQuery('vchat:rxok', (ctx) => handleVetChatRxConfirm(ctx));

  // Secure chat end → wipe entire conversation (inline CTA; not sticky ReplyKeyboard)
  bot.callbackQuery(/^securewipe:pd:(\d+)$/, async (ctx) => {
    try {
      await handleSecureWipePlaydateCallback(ctx, Number(ctx.match![1]));
    } catch (err) {
      console.error('securewipe playdate failed:', err);
      await ctx.answerCallbackQuery({ text: 'خطا', show_alert: true }).catch(() => undefined);
    }
  });
  bot.callbackQuery(/^securewipe:vc:(\d+)$/, async (ctx) => {
    try {
      await handleSecureWipeVetCallback(ctx, Number(ctx.match![1]));
    } catch (err) {
      console.error('securewipe vet failed:', err);
      await ctx.answerCallbackQuery({ text: 'خطا', show_alert: true }).catch(() => undefined);
    }
  });

  bot.callbackQuery(/^vet:/, (ctx) => handleComingSoon(ctx, 'مشاوره دامپزشک'));
  bot.callbackQuery('shop:home', (ctx) => handleShopHome(ctx));
  bot.callbackQuery('shop:orders', (ctx) => handleShopOrders(ctx));
  bot.callbackQuery('shop:featured', (ctx) => handleShopFeatured(ctx));
  bot.callbackQuery('shop:backcat', (ctx) => handleShopBackCategories(ctx));
  bot.callbackQuery('shop:noop', (ctx) => handleShopNoop(ctx));
  bot.callbackQuery(/^shop:pet:(dog|cat|bird)$/, (ctx) =>
    handleShopPetType(ctx, ctx.match![1]!)
  );
  bot.callbackQuery(/^shop:c:(.+)$/, (ctx) => handleShopCategory(ctx, ctx.match![1]!));
  bot.callbackQuery(/^shop:page:([^:]+):(\d+)$/, (ctx) =>
    handleShopPage(ctx, ctx.match![1]!, Number(ctx.match![2]))
  );
  bot.callbackQuery(/^shop:v:(.+)$/, (ctx) => handleShopView(ctx, ctx.match![1]!));
  bot.callbackQuery(/^shop:buy:([^:]+):(\d+)$/, (ctx) =>
    handleShopBuy(ctx, ctx.match![1]!, Number(ctx.match![2]))
  );
  bot.callbackQuery(/^shop:buyStars:([^:]+):(\d+)$/, (ctx) =>
    handleShopBuyStars(ctx, ctx.match![1]!, Number(ctx.match![2]))
  );
  bot.callbackQuery(/^shop:method:(coins|wstars|xtr|toman|card):([^:]+):(\d+)$/, (ctx) =>
    handleShopSetPayMethod(ctx, ctx.match![1]!, ctx.match![2]!, Number(ctx.match![3]))
  );
  bot.callbackQuery(/^shop:payNow:([^:]+):(\d+)$/, (ctx) =>
    handleShopPay(ctx, ctx.match![1]!, Number(ctx.match![2]))
  );
  bot.callbackQuery(/^shop:pay:([^:]+):(\d+)$/, (ctx) =>
    handleShopPay(ctx, ctx.match![1]!, Number(ctx.match![2]), 'coins')
  );
  bot.callbackQuery(/^shop:payStars:([^:]+):(\d+)$/, (ctx) =>
    handleShopPayStars(ctx, ctx.match![1]!, Number(ctx.match![2]))
  );
  bot.callbackQuery(/^shop:/, (ctx) => handleShopHome(ctx));
  bot.callbackQuery(/^svc:/, (ctx) => handleComingSoon(ctx, 'خدمات'));

  bot.callbackQuery('coins:daily', (ctx) => handleCoinsDaily(ctx));
  bot.callbackQuery('coins:daily:done', (ctx) => handleCoinsDailyDone(ctx));
  bot.callbackQuery('coins:tx', (ctx) => handleCoinsTransactions(ctx));
  bot.callbackQuery('coins:invite', async (ctx) => {
    await ctx.answerCallbackQuery();
    return handleInviteFriends(ctx);
  });
  bot.callbackQuery(/^coins:pkg:(.+)$/, (ctx) => handleCoinsPackage(ctx, ctx.match![1]!));
  bot.callbackQuery(/^coins:pay:(stars|card):(.+)$/, (ctx) =>
    handleCoinsPay(ctx, ctx.match![1] as 'stars' | 'card', ctx.match![2]!)
  );
  bot.callbackQuery('coins:pay:cancel', (ctx) => handleCoinsPayCancel(ctx));
  bot.callbackQuery('coins:pay:receipt', (ctx) => handleCoinsSendReceiptPrompt(ctx));
  bot.callbackQuery('coins:back', (ctx) => handleCoinsBack(ctx));
  bot.callbackQuery(/^pay:approve:(\d+)$/, (ctx) =>
    handlePaymentApprove(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^pay:reject:(\d+)$/, (ctx) =>
    handlePaymentReject(ctx, Number(ctx.match![1]))
  );

  bot.callbackQuery(/^wstars:buy:(\d+)$/, (ctx) =>
    handleWalletStarsTopUpBuy(ctx, ctx.match![1]!)
  );
  bot.on('pre_checkout_query', (ctx) => handlePreCheckout(ctx));
  bot.on('message:successful_payment', (ctx) => handleSuccessfulPayment(ctx));

  bot.callbackQuery('earn:sell', (ctx) => handleEarnSell(ctx));
  bot.callbackQuery(/^earn:confirm:(\d+)$/, (ctx) =>
    handleEarnConfirm(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery('earn:cancel', (ctx) => handleEarnCancel(ctx));
  bot.callbackQuery('earn:close', (ctx) => handleEarnClose(ctx));

  bot.callbackQuery(/^search:page:([^:]+):(\d+)$/, (ctx) =>
    handleSearchPage(ctx, ctx.match![1]!, Number(ctx.match![2]))
  );
  bot.callbackQuery(/^search:pet:(\d+)$/, (ctx) =>
    handleSearchPetView(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery(/^search:owner:(\d+)$/, (ctx) =>
    handleSearchOwnerView(ctx, Number(ctx.match![1]))
  );
  bot.callbackQuery('search:menu', (ctx) => handleSearchMenuCallback(ctx));
  bot.callbackQuery('search:home', (ctx) => handleSearchHomeCallback(ctx));
  bot.callbackQuery('search:nearby:askloc', (ctx) => handleSearchNearbyAskLocCallback(ctx));
  bot.callbackQuery(/^search:go:([a-z]+)$/, (ctx) =>
    handleSearchGoCallback(ctx, ctx.match![1]!)
  );
  bot.callbackQuery(/^nearby:radius:(\d+)$/, async (ctx) => {
    try {
      await handleNearbyRadiusCallback(ctx, Number(ctx.match![1]));
    } catch (err) {
      console.error('nearby:radius handler failed:', err);
      try {
        await ctx.answerCallbackQuery({ text: 'خطا — دوباره بزن', show_alert: true });
      } catch {
        /* ignore */
      }
    }
  });
  bot.callbackQuery('nearby:pick-radius', (ctx) => handleNearbyPickRadiusCallback(ctx));
  bot.callbackQuery('nearby:summary', (ctx) => handleNearbySummaryCallback(ctx));
  bot.callbackQuery(/^nearby:list:(\d+)$/, (ctx) =>
    handleNearbyListCallback(ctx, Number(ctx.match![1]))
  );

  bot.on('message:location', async (ctx) => {
    if (await handleNearbyLocationMessage(ctx)) return;
  });

  bot.on('message:contact', async (ctx) => {
    if (await handlePhoneVerifyContact(ctx)) return;
    await handleProfileContact(ctx);
  });

  bot.on('message:photo', async (ctx) => {
    if (await handleOwnerChatRelay(ctx)) return;
    if (await handleVetChatRelay(ctx)) return;
    // اول بر اساس session.step مسیریابی کن تا handler اشتباه عکس را نبلعد
    const step = ctx.from ? (await getSession(String(ctx.from.id)))?.step : undefined;
    if (step === 'pet_photo') {
      if (await handlePetEditPhoto(ctx)) return;
      if (await handlePetPhoto(ctx)) return;
    }
    if (step === 'payment_receipt') {
      if (await handlePaymentReceiptPhoto(ctx)) return;
    }
    if (step === 'verify_photo') {
      if (await handleVerifyPhoto(ctx)) return;
    }
    if (step === 'vet_credential') {
      if (await handleVetCredentialPhoto(ctx)) return;
    }
    if (step === 'trainer_credential') {
      if (await handleProviderCredentialPhoto(ctx, 'trainer')) return;
    }
    if (step === 'sitter_credential') {
      await handleRequestSitter(ctx);
      return;
    }
    if (step === 'profile_photo') {
      if (await handleProfilePhoto(ctx)) return;
    }
    // fallback (سشن نامشخص / قدیمی)
    if (await handlePaymentReceiptPhoto(ctx)) return;
    if (await handleVerifyPhoto(ctx)) return;
    if (await handleVetCredentialPhoto(ctx)) return;
    if (await handlePetEditPhoto(ctx)) return;
    if (await handlePetPhoto(ctx)) return;
    await handleProfilePhoto(ctx);
  });

  bot.on('message:video', async (ctx) => {
    if (await handleVerifyVideo(ctx)) return;
  });

  bot.on('message:video_note', async (ctx) => {
    if (await handleVerifyVideo(ctx)) return;
  });

  bot.on('message:document', async (ctx) => {
    if (await handleOwnerChatRelay(ctx)) return;
    if (await handleVetChatRelay(ctx)) return;
    const step = ctx.from ? (await getSession(String(ctx.from.id)))?.step : undefined;
    if (step === 'payment_receipt') {
      if (await handlePaymentReceiptPhoto(ctx)) return;
    }
    if (step === 'pet_photo') {
      if (await handlePetPhoto(ctx)) return;
    }
    if (step === 'vet_credential') {
      if (await handleVetCredentialDocument(ctx)) return;
    }
    if (await handlePaymentReceiptPhoto(ctx)) return;
    if (await handlePetPhoto(ctx)) return;
    if (await handleVetCredentialDocument(ctx)) return;
  });

  bot.on('message:voice', async (ctx) => {
    if (await handleSupportChatVoice(ctx)) return;
    if (await handleOwnerChatRelay(ctx)) return;
    if (await handleVetChatRelay(ctx)) return;
  });

  bot.on('message:audio', async (ctx) => {
    if (await handleSupportChatVoice(ctx)) return;
    if (await handleOwnerChatRelay(ctx)) return;
    if (await handleVetChatRelay(ctx)) return;
  });

  bot.on('message:text', handleTextMessage);
}

async function handleTextMessage(ctx: Context): Promise<void> {
  const text = ctx.message?.text?.trim();
  if (!text || text.startsWith('/')) return;

  // پشتیبانی هوشمند — قبل از رله‌های چت تا پیام‌های بعدی گم نشوند
  if (ctx.from) {
    const supportSession = await getSession(String(ctx.from.id));
    if (
      supportSession?.step === 'support_chat' ||
      supportSession?.step === 'support_ticket_title' ||
      supportSession?.step === 'support_ticket_body'
    ) {
      if (await handleSupportChatText(ctx, text)) return;
    }
  }

  // چت همبازی مالک↔مالک و چت مشاوره دامپزشک — اولویت بالا
  if (await handleOwnerChatRelay(ctx)) return;
  if (await handleVetChatRelay(ctx)) return;

  // Global cancel from reply keyboard while in any flow
  if (text === WIZARD_NAV.cancel) {
    const from = ctx.from;
    if (from) {
      const session = await getSession(String(from.id));
      if (session && session.step !== 'ready' && session.step !== 'start') {
        await handleCancel(ctx);
        return;
      }
    }
  }

  // «📋 منو» / «منو» / «منوی اصلی» — از هر جریان گیرکرده‌ای خارج شو و منو را نشان بده
  // (به‌جز انتخاب نقش اولیه که هنوز کاربر نقش ندارد)
  if (text === SEND_RECEIPT_BTN) {
    await handleCoinsSendReceiptPrompt(ctx);
    return;
  }
  if (text === CANCEL_PAYMENT_BTN) {
    if (ctx.from) {
      await upsertSession(String(ctx.from.id), {
        step: 'ready',
        paymentPendingOrderId: undefined,
      });
    }
    const user = await getCtxUser(ctx);
    await ctx.reply('پرداخت لغو شد.', { reply_markup: menuKeyboardFor(ctx, user) });
    return;
  }

  if (MAIN_MENU_ALIASES.has(text) || text === MAIN_MENU_BTN) {
    const from = ctx.from;
    if (from) {
      const session = await getSession(String(from.id));
      if (session?.step === 'role_select') {
        // بگذار handleRoleReplyText مدیریت کند / نادیده بگیرد
      } else {
        // منو باید ویزارد/عکس/پرداخت گیرکرده را باز کند (مثل /cancel)
        if (session && session.step !== 'ready' && session.step !== 'start') {
          await handleCancel(ctx);
          return;
        }
        await handleMenu(ctx);
        return;
      }
    } else {
      await handleMenu(ctx);
      return;
    }
  }

  // Role selection via reply keyboard
  if (await handleRoleReplyText(ctx, text)) return;

  if (await handleAdminPasswordText(ctx, text)) return;
  if (await handleAdminMenuText(ctx, text)) return;
  if (await handleAdminRejectReasonText(ctx, text)) return;
  if (await handleShopCheckoutText(ctx, text)) return;
  if (await handlePhoneVerifyText(ctx, text)) return;
  if (await handleEarnCardText(ctx, text)) return;
  if (await handleSearchBreedText(ctx, text)) return;
  if (await handleVetCredentialText(ctx, text)) return;
  if (await handleVetVisitFeeText(ctx, text)) return;
  if (await handleProfileWizardText(ctx, text)) return;
  if (await handlePetEditText(ctx, text)) return;
  if (await handleWizardText(ctx, text)) return;
  if (await handleSupportChatText(ctx, text)) return;

  // اگر منتظر موقعیت هستیم و کاربر متن فرستاد — یادآوری دکمه
  if (ctx.from) {
    const session = await getSession(String(ctx.from.id));
    if (session?.step === 'awaiting_location_for_nearby') {
      // دکمه‌های منوی اصلی باید از این حالت خارج شوند
      if (MENU_LABELS.has(text) && text !== WIZARD_NAV.shareLocation) {
        await upsertSession(String(ctx.from.id), {
          step: 'ready',
          searchLat: undefined,
          searchLng: undefined,
        });
        // fall through to menu switch
      } else {
        if (text === WIZARD_NAV.shareLocation) {
          await ctx.reply('از دکمه تلگرام «ارسال موقعیت» استفاده کن تا لوکیشن واقعی ارسال بشه.', {
            reply_markup: nearbyLocationKeyboard(),
          });
          return;
        }
        await ctx.reply(`برای دیدن پت‌های نزدیک، دکمه «${WIZARD_NAV.shareLocation}» رو بزن.`, {
          reply_markup: nearbyLocationKeyboard(),
        });
        return;
      }
    }
  }

  const m = PET_OWNER_MENU;
  const d = DEFAULT_MENU;
  const n = NO_PET_MENU;
  const s = PET_SEEKER_MENU;
  const v = VET_MENU;
  const petsSection = MY_PETS_SECTION;
  const search = SEARCH_PETS_MENU;

  switch (text) {
    case m.findPlaymate:
    case d.explore:
    case n.explore:
    case s.explore:
      return handleFindPlaymate(ctx);
    case s.petsAndPlaymates:
      return handlePetsAndPlaymates(ctx);
    case s.readyAdoptOn:
      return handleReadyToAdoptToggle(ctx, true);
    case s.readyAdoptOff:
      return handleReadyToAdoptToggle(ctx, false);
    case n.ownerConsult:
    case n.buyConsult:
    case s.requestOwnerAdvice:
      return handleRequestSeekerAdvice(ctx);
    case v.goOnline:
    case '🟢 آنلاین هستم و آماده پذیرش بیمار': {
      if (!(await ensureVetPhoneVerified(ctx))) return;
      return handleVetOnlineToggle(ctx, true);
    }
    case v.goOffline:
    case '🔴 آفلاین هستم': {
      if (!(await ensureVetPhoneVerified(ctx))) return;
      return handleVetOnlineToggle(ctx, false);
    }
    case v.recentPatients:
    case '🩺 آخرین بیمارها': {
      if (!(await ensureVetPhoneVerified(ctx))) return;
      return handleVetRecentPatients(ctx);
    }
    case v.visitFee:
    case '💰 مبلغ ویزیت': {
      if (!(await ensureVetPhoneVerified(ctx))) return;
      return handleVetVisitFeeMenu(ctx);
    }
    case m.nearbyPets:
    case '📍 پت‌های نزدیک من':
      return handleNearbyPets(ctx);
    case m.searchPets:
      return handleSearchPetsMenu(ctx);
    case search.byBreed:
    case search.advanced:
      return handleSearchByBreedStart(ctx);
    case search.sameProvince:
    case search.sameProvinceLegacy:
      return handleSearchSameProvince(ctx);
    case search.sameBreed:
      return handleSearchSameBreed(ctx);
    case search.mashhad:
      return handleSearchMashhad(ctx);
    case search.allPets:
    case search.viewAll:
      return handleSearchAll(ctx);
    case search.newest:
      return handleSearchNewest(ctx);
    case search.popular:
      return handleSearchPopular(ctx);
    case search.backToMenu:
    case search.menu:
    case m.menu:
    case d.menu:
    case n.menu:
    case s.menu:
    case v.menu:
    case petsSection.menu:
    case petsSection.backToMenu: {
      return handleMenu(ctx);
    }
    case m.myProfile:
    case '👤 پروفایل خودم':
    case d.profile:
    case n.profile:
    case s.profile:
    case v.profile:
      return handleProfile(ctx);
    case m.verify:
    case d.verify:
    case n.verify:
    case s.verify:
    case v.verify:
    case '🛡 احراز هویت':
      return handleVerifyStart(ctx);
    case m.phoneVerify:
    case d.phoneVerify:
    case n.phoneVerify:
    case s.phoneVerify:
    case v.phoneVerify:
      return handlePhoneVerifyStart(ctx);
    case m.myPets:
    case d.myPets:
    case n.myPets:
    case s.myPets:
      return handleMyPets(ctx);
    case m.addPet:
    case d.addPet:
    case petsSection.addPet:
      return handleAddPetCommand(ctx);
    case m.coins:
    case d.coins:
    case n.coins:
    case s.coins:
    case v.coins:
      return handleCoins(ctx);
    case m.earn:
      return handleEarn(ctx);
    case '🩺 پزشکی':
      // دکمه قدیمی حذف‌شده از منو
      {
        const user = await getCtxUser(ctx);
        await ctx.reply('این دکمه از منوی ربات حذف شده.', {
          reply_markup: menuKeyboardFor(ctx, user),
        });
      }
      return;
    case m.invite:
    case '🎁 معرفی به دوستان':
    case d.invite:
    case n.invite:
    case s.invite:
    case v.invite:
      return handleInviteFriends(ctx);
    case m.chat:
    case d.chat:
    case n.chat:
    case s.chat:
    case v.chat:
      // دکمه چت از همه نقش‌ها حذف شد
      {
        const user = await getCtxUser(ctx);
        await ctx.reply('دکمه چت از منوی ربات حذف شده. از وب یا گفتگوی مستقیم استفاده کن.', {
          reply_markup: menuKeyboardFor(ctx, user),
        });
      }
      return;
    case m.help:
    case d.help:
    case n.help:
    case s.help:
    case v.help:
      return handleHelp(ctx);
    case m.support:
      return handleSupportMenu(ctx);
    case m.myRoles:
    case d.myRoles:
    case n.myRoles:
    case s.myRoles:
    case v.myRoles:
      return handleMyRoles(ctx);
    case m.quickVet:
    case '⚡ مشاوره سریع با پزشک':
    case '⚡ ارتباط سریع با پزشک':
      return handleQuickVet(ctx);
    case m.requestTrainer:
      return handleRequestTrainer(ctx);
    case '🏠 درخواست پرستار پت':
      return handleRequestSitter(ctx);
    case m.seekerAdviceOn:
      return handleToggleSeekerAdvice(ctx, false);
    case m.seekerAdviceOff:
      return handleToggleSeekerAdvice(ctx, true);
    case TRAINER_MENU.goOnline:
      return handleProviderOnlineToggle(ctx, 'trainer', true);
    case TRAINER_MENU.goOffline:
      return handleProviderOnlineToggle(ctx, 'trainer', false);
    case TRAINER_MENU.recentClients:
      return handleProviderRecentClients(ctx, 'trainer');
    case TRAINER_MENU.uploadCredential:
      return handleProviderCredentialStart(ctx, 'trainer');
    case SITTER_MENU.goOnline:
      return handleProviderOnlineToggle(ctx, 'sitter', true);
    case SITTER_MENU.goOffline:
      return handleProviderOnlineToggle(ctx, 'sitter', false);
    case SITTER_MENU.recentClients:
      return handleProviderRecentClients(ctx, 'sitter');
    case SITTER_MENU.uploadCredential:
      return handleProviderCredentialStart(ctx, 'sitter');
    case m.shop:
    case '🛒 پت شاپ':
    case d.shop:
    case n.shop:
    case s.shop:
    case v.shop:
      return handlePetShop(ctx);
    case m.services:
      return handleServices(ctx);
    case '📬 درخواست‌ها':
    case 'درخواست‌ها':
      // دکمه قدیمی حذف‌شده از منو — نادیده بگیر و منوی اصلی را تازه کن
      {
        const user = await getCtxUser(ctx);
        await ctx.reply('این دکمه حذف شده. از منوی جدید استفاده کن 👇', {
          reply_markup: menuKeyboardFor(ctx, user),
        });
      }
      return;
    default:
      if (!MENU_LABELS.has(text)) {
        const user = await getCtxUser(ctx);
        await ctx.reply('از منو یا /help استفاده کن.', {
          reply_markup: menuKeyboardFor(ctx, user),
        });
      }
  }
}

async function handleRoleReplyText(ctx: Context, text: string): Promise<boolean> {
  const from = ctx.from;
  if (!from) return false;

  const session = await getSession(String(from.id));
  if (!session || session.step !== 'role_select') return false;

  if (text === ROLE_CONFIRM_LABEL) {
    await handleRoleConfirm(ctx);
    return true;
  }

  const normalized = text.replace(/^✓\s*/, '').trim();
  const role = USER_ROLES.find(
    (r) => USER_ROLE_LABELS[r] === text || USER_ROLE_LABELS[r] === normalized
  );
  if (!role) {
    await ctx.reply(
      `لطفاً نقش رو از دکمه‌ها انتخاب کن، بعد «${ROLE_CONFIRM_LABEL}» رو بزن.`
    );
    return true;
  }

  await handleRoleSelect(ctx, role);
  return true;
}
