import { Sequelize, DataTypes } from 'sequelize';
import { config } from './config.js';

export const sequelize = new Sequelize(config.db.name, config.db.user, config.db.password, {
  host: config.db.host,
  port: config.db.port,
  dialect: 'postgres',
  logging: false,
  define: { underscored: true },
});

/** Pipeline states a contact moves through. */
export const STATUSES = [
  'imported',          // files received
  'extracted',         // AI turned files into profile JSON
  'reviewed',          // you checked the data
  'built',             // site generated + QA ran
  'preview_approved',  // you approved the private preview
  'preview_sent',      // you sent the message
  'changes_requested', // they asked for edits
  'consented',         // they tapped "Publish it"
  'declined',          // they tapped "No thanks"
  'published',         // live on GitHub Pages
  'failed',            // an agent step failed (see activity log)
];

export const LEAD_STAGES = ['new', 'talking', 'proposal', 'won', 'lost'];

export const Contact = sequelize.define('contact', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  fullName: { type: DataTypes.STRING, allowNull: false, defaultValue: 'Unnamed' },
  slug: { type: DataTypes.STRING, unique: true },
  linkedinUrl: DataTypes.STRING,
  email: DataTypes.STRING,
  phone: DataTypes.STRING,
  whatsapp: DataTypes.STRING,
  relationshipNote: DataTypes.STRING,
  photoPath: DataTypes.STRING,
  status: { type: DataTypes.ENUM(...STATUSES), defaultValue: 'imported' },
  statusChangedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  purgedAt: DataTypes.DATE,
});

export const SourceFile = sequelize.define('source_file', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  kind: { type: DataTypes.ENUM('profile_pdf', 'screenshot', 'photo', 'resume'), allowNull: false },
  storagePath: DataTypes.STRING,
  originalName: DataTypes.STRING,
  mimeType: DataTypes.STRING,
  originalUrl: DataTypes.STRING,
});

export const Profile = sequelize.define('profile', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
  data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  flags: { type: DataTypes.JSONB, defaultValue: [] }, // [{field, reason}]
  extractedBy: DataTypes.STRING,
  reviewedAt: DataTypes.DATE,
});

export const Template = sequelize.define('template', {
  id: { type: DataTypes.STRING, primaryKey: true }, // 'aurora' | 'monolith' | 'folio'
  name: DataTypes.STRING,
  description: DataTypes.STRING,
  active: { type: DataTypes.BOOLEAN, defaultValue: true },
});

export const Site = sequelize.define('site', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  version: { type: DataTypes.INTEGER, defaultValue: 1 },
  content: { type: DataTypes.JSONB, defaultValue: {} },
  previewToken: { type: DataTypes.STRING, unique: true },
  qaStatus: { type: DataTypes.ENUM('pending', 'passed', 'warnings', 'failed'), defaultValue: 'pending' },
  qaReport: { type: DataTypes.JSONB, defaultValue: [] },
  outputDir: DataTypes.STRING,
});

export const Approval = sequelize.define('approval', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  stage: { type: DataTypes.ENUM('preview', 'publish'), allowNull: false },
  decision: { type: DataTypes.ENUM('approved', 'sent_back'), allowNull: false },
  note: DataTypes.TEXT,
});

export const Consent = sequelize.define('consent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  decision: { type: DataTypes.ENUM('publish', 'changes', 'decline'), allowNull: false },
  message: DataTypes.TEXT,
  ipHash: DataTypes.STRING,
});

export const Deployment = sequelize.define('deployment', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  githubRepo: DataTypes.STRING,
  commitSha: DataTypes.STRING,
  pagesUrl: DataTypes.STRING,
  status: { type: DataTypes.ENUM('queued', 'deploying', 'live', 'failed', 'taken_down'), defaultValue: 'queued' },
  error: DataTypes.TEXT,
  deployedAt: DataTypes.DATE,
  takedownAt: DataTypes.DATE,
});

export const Message = sequelize.define('message', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  channel: { type: DataTypes.ENUM('whatsapp', 'linkedin', 'email'), defaultValue: 'whatsapp' },
  templateKey: { type: DataTypes.ENUM('preview', 'nudge', 'live', 'thanks'), allowNull: false },
  body: DataTypes.TEXT,
  highlight: DataTypes.STRING, // the personal detail the Writer chose
  status: { type: DataTypes.ENUM('draft', 'sent'), defaultValue: 'draft' },
  sentAt: DataTypes.DATE,
  remindAt: DataTypes.DATE,
  replyReceivedAt: DataTypes.DATE,
});

export const Lead = sequelize.define('lead', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  title: DataTypes.STRING,
  need: { type: DataTypes.ENUM('website', 'web_app', 'mobile_app', 'software', 'referral', 'other'), defaultValue: 'website' },
  stage: { type: DataTypes.ENUM(...LEAD_STAGES), defaultValue: 'new' },
  valueInr: { type: DataTypes.INTEGER, defaultValue: 0 },
  notes: DataTypes.TEXT,
  nextStep: DataTypes.STRING,
  nextStepDate: DataTypes.DATEONLY,
});

export const Activity = sequelize.define('activity', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  actor: { type: DataTypes.STRING, defaultValue: 'system' }, // you | person | Extractor | Writer | Builder | QA | Publisher | Outreach
  event: DataTypes.STRING,
  text: DataTypes.STRING,
  payload: { type: DataTypes.JSONB, defaultValue: {} },
}, { updatedAt: false });

// ── Relations ──────────────────────────────────────────
Contact.hasMany(SourceFile, { onDelete: 'CASCADE' }); SourceFile.belongsTo(Contact);
Contact.hasMany(Profile, { onDelete: 'CASCADE' }); Profile.belongsTo(Contact);
Contact.hasMany(Site, { onDelete: 'CASCADE' }); Site.belongsTo(Contact);
Template.hasMany(Site); Site.belongsTo(Template);
Site.hasMany(Approval, { onDelete: 'CASCADE' }); Approval.belongsTo(Site);
Site.hasMany(Consent, { onDelete: 'CASCADE' }); Consent.belongsTo(Site);
Site.hasMany(Deployment, { onDelete: 'CASCADE' }); Deployment.belongsTo(Site);
Contact.hasMany(Deployment, { onDelete: 'CASCADE' }); Deployment.belongsTo(Contact);
Contact.hasMany(Message, { onDelete: 'CASCADE' }); Message.belongsTo(Contact);
Contact.hasMany(Lead, { onDelete: 'SET NULL' }); Lead.belongsTo(Contact);
Contact.hasMany(Activity, { onDelete: 'CASCADE' }); Activity.belongsTo(Contact);

export const TEMPLATES = [
  { id: 'aurora', name: 'Aurora', description: 'Warm paper, serif headline, arched photo' },
  { id: 'monolith', name: 'Monolith', description: 'Dark, bold sans, high contrast' },
  { id: 'folio', name: 'Folio', description: 'Deep navy, clean grid, card sections' },
];

export async function initDb() {
  await sequelize.authenticate();
  await sequelize.sync({ alter: true });
  for (const t of TEMPLATES) await Template.upsert(t);
}
