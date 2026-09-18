import { Link } from 'react-router-dom';
import { ADMIN_GUIDE, type AdminGuideLesson } from './adminGuideContent';

function groupsOf(lessons: AdminGuideLesson[]): string[] {
  const out: string[] = [];
  for (const lesson of lessons) {
    if (!out.includes(lesson.group)) out.push(lesson.group);
  }
  return out;
}

export function AdminGuidePage() {
  const groups = groupsOf(ADMIN_GUIDE);

  return (
    <div className="admin-page admin-guide-page">
      <header className="admin-header">
        <div>
          <h1>راهنمای کار با پنل</h1>
          <p>
            این صفحه آموزش عملی است، نه خلاصه. برای هر آیتم منو: این بخش چه کاری می‌کند،
            قدم‌به‌قدم چه چیزی را بزنید و ذخیره کنید، تصویر همان صفحه، و جاهایی که معمولاً اشتباه می‌شود.
            لینک «راهنما» بالای پنل همیشه به همین‌جا برمی‌گردد.
          </p>
        </div>
      </header>

      <nav className="admin-guide-toc" aria-label="فهرست راهنما">
        {groups.map((group) => (
          <div key={group} className="admin-guide-toc-group">
            <strong>{group}</strong>
            <div className="admin-guide-toc-links">
              {ADMIN_GUIDE.filter((lesson) => lesson.group === group).map((lesson) => (
                <a key={lesson.id} href={`#guide-${lesson.id}`}>
                  {lesson.title}
                </a>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {ADMIN_GUIDE.map((lesson, index) => (
        <section key={lesson.id} id={`guide-${lesson.id}`} className="admin-card admin-guide-section">
          <header className="admin-guide-head">
            <p className="admin-guide-kicker">
              {lesson.group}
              {' · '}
              درس {index + 1}
            </p>
            <h2>
              <Link to={lesson.path}>{lesson.title}</Link>
            </h2>
            <p className="admin-muted admin-guide-path" dir="ltr">
              {lesson.path}
            </p>
          </header>
          <div className="admin-guide-lesson">
            <figure className="admin-guide-figure">
              <img
                src={lesson.image}
                alt={`نمای صفحه ${lesson.title} در پنل ادمین`}
                width={1280}
                height={800}
                loading={index < 2 ? 'eager' : 'lazy'}
              />
              <figcaption>تصویر همین بخش، از پنل در حالت تیره</figcaption>
            </figure>
            <div className="admin-guide-copy">
              <p className="admin-guide-purpose">{lesson.purpose}</p>
              <h3>فرآیند</h3>
              <ol className="admin-guide-steps">
                {lesson.steps.map((step, stepIndex) => (
                  <li key={`${lesson.id}-s${stepIndex}`}>{step}</li>
                ))}
              </ol>
              <h3>کجا را بزنید و کجا اشتباه می‌شود</h3>
              <ul className="admin-guide-mistakes">
                {lesson.mistakes.map((item, itemIndex) => (
                  <li key={`${lesson.id}-m${itemIndex}`}>{item}</li>
                ))}
              </ul>
              {lesson.empty ? <p className="admin-guide-empty">{lesson.empty}</p> : null}
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}
