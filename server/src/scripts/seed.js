// Adds two clearly-labelled demo people so you can try the full flow without real data.
// Run: npm run seed      Remove later from the app (People › delete).
import { ensureDatabase } from './db-create.js';
import { initDb, Contact, Profile, sequelize } from '../db.js';
import { normalizeProfile } from '../services/extractor.js';
import { buildSite } from '../services/pipeline.js';
import { uniqueSlug, setStatus, log } from '../services/util.js';

const demos = [
  {
    note: 'DEMO · delete me',
    template: 'aurora',
    profile: {
      fullName: 'Demo Priya Sharma', headline: 'Senior Software Engineer · Payments', location: 'Bengaluru, Karnataka, India',
      about: 'Backend engineer with six years in fintech. I design APIs and reconciliation services and mentor new engineers.',
      email: 'priya.demo@example.com', linkedinUrl: 'https://www.linkedin.com/in/example',
      experience: [
        { title: 'Senior Software Engineer', company: 'Payments platform', start: 'Jan 2023', end: 'Present', description: 'Leads the reconciliation service that matches settlements across banks.' },
        { title: 'Software Engineer', company: 'IT services firm', start: 'Jul 2020', end: 'Dec 2022', description: 'Built internal APIs for banking clients.' },
      ],
      education: [{ school: 'NIT Patna', degree: 'B.Tech, Computer Science', start: '2016', end: '2020' }],
      skills: ['Go', 'PostgreSQL', 'Kafka', 'System design', 'AWS', 'Mentoring'],
    },
  },
  {
    note: 'DEMO · delete me',
    template: 'monolith',
    profile: {
      fullName: 'Demo Rohit Verma', headline: 'Product Manager · ex-Mechanical Engineer', location: 'Pune, Maharashtra, India',
      about: 'Mechanical engineer turned product manager. I work on payments features for small businesses.',
      email: 'rohit.demo@example.com',
      experience: [
        { title: 'Product Manager', company: 'Fintech startup', start: 'Mar 2021', end: 'Present', description: 'Owns merchant onboarding and payouts.' },
        { title: 'Design Engineer', company: 'Auto components maker', start: '2017', end: '2021', description: 'Designed engine mounts.' },
      ],
      skills: ['Product discovery', 'SQL', 'Roadmaps', 'CAD'],
    },
  },
];

await ensureDatabase();
await initDb();
for (const d of demos) {
  const c = await Contact.create({ fullName: d.profile.fullName, slug: await uniqueSlug(d.profile.fullName), relationshipNote: d.note, email: d.profile.email });
  await Profile.create({ contactId: c.id, version: 1, data: normalizeProfile(d.profile), extractedBy: 'manual', reviewedAt: new Date() });
  await setStatus(c, 'reviewed');
  await log(c.id, 'you', 'imported', `Imported ${c.fullName} (demo)`);
  await buildSite(c.id, { templateId: d.template });
  console.log(`Seeded ${c.fullName}`);
}
await sequelize.close();
