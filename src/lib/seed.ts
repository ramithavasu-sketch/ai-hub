import type { Db, Project, Resource, Update, Comment, Activity, Person, Department, Feedback } from './types';

// All names and data below are made up for the demo.

export const DB_VERSION = 3;

const DAY = 86_400_000;
const ago = (days: number, hour = 10) => {
  const d = new Date(Date.now() - days * DAY);
  d.setHours(hour, (days * 37) % 60, 0, 0);
  return d.toISOString();
};

const departments: Department[] = [
  { id: 'd-cs', name: 'Customer Success', description: 'Support, call quality and customer experience', hue: 168 },
  { id: 'd-qa', name: 'Quality Assurance', description: 'Call audits, calibration and quality standards', hue: 140 },
  { id: 'd-eng', name: 'Product & Engineering', description: 'Platform, apps and internal tooling', hue: 222 },
  { id: 'd-design', name: 'Design', description: 'Product design, brand and research', hue: 262 },
  { id: 'd-mkt', name: 'Marketing', description: 'Content, campaigns and growth', hue: 28 },
  { id: 'd-sales', name: 'Sales', description: 'Pipeline, partnerships and onboarding', hue: 340 },
  { id: 'd-people', name: 'People & Culture', description: 'Hiring, learning and wellbeing', hue: 48 },
  { id: 'd-ops', name: 'Finance & Operations', description: 'Billing, planning and process', hue: 195 },
];

const p = (id: string, name: string, title: string, departmentId: string, accessRole: Person['accessRole'], bio: string, interests: string[]): Person => ({
  id, name, title, departmentId, accessRole, bio, interests, active: true,
  email: `${name.toLowerCase().split(' ').join('.')}@example.com`,
});

const people: Person[] = [
  p('u-asha', 'Asha Raman', 'QA Lead', 'd-cs', 'admin', 'Runs call quality for the support floor and keeps the AI Hub tidy. Happiest when a manual process becomes a two-click one.', ['Speech analytics', 'Prompt design', 'Coaching']),
  p('u-leo', 'Leo Fernandes', 'Senior Engineer', 'd-eng', 'contributor', 'Builds internal tools and loves turning prototypes into things people actually use.', ['LLM apps', 'RAG', 'TypeScript']),
  p('u-mira', 'Mira Okafor', 'Product Designer', 'd-design', 'contributor', 'Designs calm interfaces for complicated work. Currently exploring how AI changes design reviews.', ['Design systems', 'Figma AI', 'UX research']),
  p('u-dev', 'Dev Malhotra', 'Data Analyst', 'd-ops', 'contributor', 'Finds the story in the numbers. Interested in forecasting and anomaly detection.', ['Forecasting', 'Python', 'Dashboards']),
  p('u-nina', 'Nina Castillo', 'Content Strategist', 'd-mkt', 'contributor', 'Writes, edits and experiments with AI-assisted content workflows.', ['Generative writing', 'SEO', 'Brand voice']),
  p('u-sam', 'Sam Whitaker', 'Account Executive', 'd-sales', 'contributor', 'Talks to customers all day and collects ideas for making that easier.', ['Sales enablement', 'Email automation']),
  p('u-priya', 'Priya Nair', 'Customer Success Manager', 'd-cs', 'contributor', 'Champions the customer voice and pilots new support tools with her team.', ['Knowledge bases', 'Chatbots', 'Voice of customer']),
  p('u-tomas', 'Tomás Reyes', 'ML Engineer', 'd-eng', 'contributor', 'Trains, evaluates and ships models. Big believer in measuring before and after.', ['Evaluation', 'Speech-to-text', 'Classification']),
  p('u-hana', 'Hana Suzuki', 'Learning & Development Partner', 'd-people', 'contributor', 'Builds learning programs and practice tools for new joiners.', ['Learning design', 'Assessment', 'Coaching bots']),
  p('u-omar', 'Omar Haddad', 'Support Specialist', 'd-cs', 'contributor', 'Front-line support with an eye for patterns in tickets.', ['Ticket triage', 'Automation']),
  p('u-ella', 'Ella Brooks', 'Recruiter', 'd-people', 'viewer', 'Hires great people and is curious about where AI can help the candidate experience.', ['Interviewing', 'Candidate experience']),
  p('u-kofi', 'Kofi Mensah', 'Finance Analyst', 'd-ops', 'contributor', 'Keeps the books honest and the reconciliations quick.', ['Anomaly detection', 'Spreadsheets']),
  p('u-zoe', 'Zoe Laurent', 'Brand Designer', 'd-design', 'viewer', 'Visual storyteller exploring image generation for campaign concepts.', ['Image generation', 'Brand']),
  p('u-ravi', 'Ravi Iyer', 'Engineering Manager', 'd-eng', 'admin', 'Leads the platform team and helps ideas find a path to production.', ['Architecture', 'AI governance']),
];

type Seed = Omit<Project, 'createdAt' | 'updatedAt' | 'allowedIds' | 'notes' | 'visibility' | 'featured'> &
  Partial<Pick<Project, 'visibility' | 'featured' | 'allowedIds' | 'notes'>> & { created: number; updated: number };

const seeds: Seed[] = [
  {
    id: 'p-call-eval', name: 'AI Call Evaluation Assistant', tagline: 'First-pass QA scoring for every support call',
    description: 'Listens to recorded support calls, transcribes them and drafts a quality evaluation against our call-handling guidelines so QA reviewers start from a strong first draft instead of a blank form.',
    problem: 'QA reviewers can only audit a small sample of calls each week, and the scoring varies between reviewers.',
    solution: 'Speech-to-text plus an LLM rubric grader that highlights evidence for each parameter. Reviewers confirm or correct the draft.',
    benefits: 'Cover more calls, give faster feedback to agents and make scoring more consistent.',
    ownerId: 'u-asha', contributorIds: ['u-tomas', 'u-leo', 'u-priya'], departmentId: 'd-cs', status: 'testing',
    technologies: ['Claude', 'Whisper', 'React', 'Supabase'], tags: ['quality', 'calls', 'coaching'], featured: true,
    proposedAt: ago(62), created: 62, updated: 1,
    journey: {
      idea: { note: 'Proposed after the Q3 calibration review showed scoring gaps.', date: ago(62) },
      research: { note: 'Rubric mapped to guidelines; Confluence write-up and two discovery calls.', date: ago(48) },
      prototype: { note: 'Prototype scores uploaded recordings and highlights evidence.', date: ago(30) },
      testing: { note: 'Pilot with 6 reviewers comparing AI drafts to manual scores.', date: ago(9) },
    },
  },
  {
    id: 'p-kb-bot', name: 'Help Centre Answer Bot', tagline: 'Instant, cited answers from our knowledge base',
    description: 'A retrieval-based assistant that answers customer and agent questions using only published help articles, always linking the source.',
    problem: 'Agents spend minutes searching the help centre for answers they know exist.',
    solution: 'Index help articles, retrieve the best passages and generate a short answer with citations.',
    benefits: 'Faster first responses and fewer escalations for routine questions.',
    ownerId: 'u-priya', contributorIds: ['u-leo', 'u-omar'], departmentId: 'd-cs', status: 'in_progress',
    technologies: ['Claude', 'RAG', 'Vector search'], tags: ['knowledge', 'support'], featured: true,
    proposedAt: ago(75), created: 75, updated: 3,
    journey: {
      idea: { note: 'Raised in the support retro as the #1 time sink.', date: ago(75) },
      research: { note: 'Compared three retrieval approaches; chose hybrid search.', date: ago(55) },
      prototype: { note: 'Internal Slack prototype answering agent questions.', date: ago(28) },
      testing: { note: 'Rolling out to two support pods.', date: ago(3) },
    },
  },
  {
    id: 'p-triage', name: 'Smart Ticket Triage', tagline: 'Route every ticket to the right queue in seconds',
    description: 'Classifies incoming tickets by product area, urgency and sentiment, then suggests the right queue and priority.',
    problem: 'Tickets bounce between queues and urgent ones wait too long.',
    solution: 'A lightweight classifier trained on two years of resolved tickets, with an LLM fallback for unclear cases.',
    benefits: 'Shorter time-to-first-touch and fewer misrouted tickets.',
    ownerId: 'u-omar', contributorIds: ['u-tomas'], departmentId: 'd-cs', status: 'prototype',
    technologies: ['Python', 'scikit-learn', 'Claude'], tags: ['tickets', 'automation'],
    proposedAt: ago(40), created: 40, updated: 6,
    journey: {
      idea: { note: 'Spotted the misrouting pattern while covering the night queue.', date: ago(40) },
      research: { note: 'Labelled 2,000 tickets with the team.', date: ago(26) },
      prototype: { note: 'Notebook prototype at 87% routing accuracy.', date: ago(6) },
    },
  },
  {
    id: 'p-design-review', name: 'Design Review Copilot', tagline: 'Accessibility and consistency checks before handoff',
    description: 'A Figma plugin that reviews frames for contrast, spacing and component usage, and writes plain-language review notes.',
    problem: 'Small consistency issues slip through and are expensive to fix after development.',
    solution: 'Read frame data through the Figma API and ask a model to compare it against our design-system rules.',
    benefits: 'Cleaner handoffs and fewer back-and-forth review rounds.',
    ownerId: 'u-mira', contributorIds: ['u-zoe', 'u-leo'], departmentId: 'd-design', status: 'research',
    technologies: ['Figma API', 'Claude', 'TypeScript'], tags: ['design', 'accessibility'], featured: true,
    proposedAt: ago(21), created: 21, updated: 2,
    journey: {
      idea: { note: 'Came out of the design-system audit.', date: ago(21) },
      research: { note: 'Listing the 25 most common review comments to automate first.', date: ago(2) },
    },
  },
  {
    id: 'p-forecast', name: 'Support Volume Forecaster', tagline: 'Predict next week’s contact volume by channel',
    description: 'Forecasts call, chat and email volume a week ahead so team leads can plan shifts with confidence.',
    problem: 'Staffing is planned on gut feel and last week’s numbers.',
    solution: 'Time-series model with holiday and release-calendar features, shown in a simple dashboard.',
    benefits: 'Better coverage at peaks and fewer idle hours at quiet times.',
    ownerId: 'u-dev', contributorIds: ['u-asha'], departmentId: 'd-ops', status: 'completed',
    technologies: ['Python', 'Prophet', 'Looker'], tags: ['forecasting', 'planning'],
    proposedAt: ago(140), created: 140, updated: 18,
    journey: {
      idea: { note: 'Requested by team leads during planning week.', date: ago(140) },
      research: { note: 'Back-tested four models on 18 months of data.', date: ago(118) },
      prototype: { note: 'Dashboard prototype reviewed with leads.', date: ago(90) },
      testing: { note: 'Ran in parallel with manual plans for 6 weeks.', date: ago(60) },
      launch: { note: 'Now used for weekly shift planning. Forecast error down to 6%.', date: ago(18) },
    },
  },
  {
    id: 'p-content', name: 'Content Repurposing Studio', tagline: 'One webinar, ten on-brand assets',
    description: 'Turns long-form content such as webinars and articles into social posts, newsletters and short summaries in our brand voice.',
    problem: 'Great long-form content gets used once and forgotten.',
    solution: 'Brand-voice prompt library plus a review queue for the content team.',
    benefits: 'More reach from existing work with less manual rewriting.',
    ownerId: 'u-nina', contributorIds: ['u-zoe'], departmentId: 'd-mkt', status: 'in_progress',
    technologies: ['Claude', 'Notion'], tags: ['content', 'brand'],
    proposedAt: ago(35), created: 35, updated: 4,
    journey: {
      idea: { note: 'Pitched at the marketing offsite.', date: ago(35) },
      research: { note: 'Brand-voice guide turned into prompt rules.', date: ago(25) },
      prototype: { note: 'Generated assets for two webinars.', date: ago(12) },
      testing: { note: 'A/B testing AI-assisted vs manual posts.', date: ago(4) },
    },
  },
  {
    id: 'p-sales-email', name: 'Personalised Follow-up Drafts', tagline: 'Meeting notes in, tailored follow-up out',
    description: 'Drafts a follow-up email after each sales call using the meeting notes and the customer’s goals.',
    problem: 'Follow-ups are slow and generic after a busy day of calls.',
    solution: 'Summarise notes, pull key goals and draft an editable email in the rep’s tone.',
    benefits: 'Faster, more relevant follow-ups.',
    ownerId: 'u-sam', contributorIds: [], departmentId: 'd-sales', status: 'idea',
    technologies: ['Claude'], tags: ['sales', 'email'],
    proposedAt: ago(5), created: 5, updated: 5,
    journey: { idea: { note: 'Idea shared after a week of 30+ calls.', date: ago(5) } },
  },
  {
    id: 'p-versant', name: 'Speaking Practice Coach', tagline: 'Mock speaking tests with instant feedback',
    description: 'A practice tool for new joiners preparing for spoken-English assessments, with timed tasks and AI feedback on fluency and clarity.',
    problem: 'New joiners have few safe ways to practise before their assessment.',
    solution: 'Timed mock test with recording, transcription and rubric-based feedback.',
    benefits: 'More confident candidates and higher first-attempt pass rates.',
    ownerId: 'u-hana', contributorIds: ['u-asha', 'u-tomas'], departmentId: 'd-people', status: 'completed',
    technologies: ['Whisper', 'Claude', 'React'], tags: ['learning', 'onboarding'], featured: true,
    proposedAt: ago(110), created: 110, updated: 11,
    journey: {
      idea: { note: 'Requested by the onboarding cohort.', date: ago(110) },
      research: { note: 'Mapped the test format and scoring bands.', date: ago(95) },
      prototype: { note: 'First mock test with six task types.', date: ago(70) },
      testing: { note: 'Piloted with two cohorts.', date: ago(40) },
      launch: { note: 'Live for all new joiners.', date: ago(11) },
    },
  },
  {
    id: 'p-onboard', name: 'Onboarding Buddy', tagline: 'Answers new-joiner questions, day or night',
    description: 'A friendly assistant that answers common onboarding questions about tools, policies and who to ask.',
    problem: 'New joiners hesitate to ask “small” questions and managers repeat the same answers.',
    solution: 'Grounded Q&A over the onboarding handbook with a hand-off to People & Culture.',
    benefits: 'Smoother first weeks and fewer repeated questions.',
    ownerId: 'u-hana', contributorIds: ['u-ella'], departmentId: 'd-people', status: 'discussion',
    technologies: ['Claude', 'RAG'], tags: ['onboarding', 'chatbot'],
    proposedAt: ago(14), created: 14, updated: 7,
    journey: {
      idea: { note: 'Suggested in new-joiner feedback survey.', date: ago(14) },
      research: { note: 'Discussing scope and data sources with People & Culture.', date: ago(7) },
    },
  },
  {
    id: 'p-invoice', name: 'Invoice Anomaly Detector', tagline: 'Flag unusual billing before it reaches customers',
    description: 'Checks each billing run for unusual amounts, duplicates and plan mismatches before invoices go out.',
    problem: 'Billing errors are found by customers, not by us.',
    solution: 'Statistical checks plus an LLM explanation of each flag for the finance team.',
    benefits: 'Fewer billing disputes and faster reconciliations.',
    ownerId: 'u-kofi', contributorIds: ['u-dev'], departmentId: 'd-ops', status: 'on_hold',
    technologies: ['Python', 'SQL', 'Claude'], tags: ['finance', 'anomaly'],
    proposedAt: ago(88), created: 88, updated: 33,
    journey: {
      idea: { note: 'Raised after a duplicate-charge incident.', date: ago(88) },
      research: { note: 'Rules drafted; paused until the billing migration finishes.', date: ago(33) },
    },
  },
  {
    id: 'p-code-review', name: 'Pull Request Review Assistant', tagline: 'A careful second pair of eyes on every PR',
    description: 'Comments on pull requests with likely bugs, missing tests and unclear naming, so human reviewers can focus on design.',
    problem: 'Review queues are long and small issues take reviewer attention.',
    solution: 'CI step that runs an AI review and posts suggestions as comments.',
    benefits: 'Faster reviews and fewer bugs reaching staging.',
    ownerId: 'u-leo', contributorIds: ['u-ravi', 'u-tomas'], departmentId: 'd-eng', status: 'in_progress',
    technologies: ['Claude Code', 'GitHub Actions'], tags: ['engineering', 'quality'],
    proposedAt: ago(50), created: 50, updated: 1,
    journey: {
      idea: { note: 'Proposed in the engineering guild.', date: ago(50) },
      research: { note: 'Agreed review guidelines and guardrails.', date: ago(38) },
      prototype: { note: 'Running on two repositories.', date: ago(20) },
      testing: { note: 'Measuring accepted vs dismissed suggestions.', date: ago(1) },
    },
  },
  {
    id: 'p-interview', name: 'Structured Interview Kit Generator', tagline: 'Role-specific questions and scorecards in minutes',
    description: 'Generates structured interview questions and scorecards from a job description, aligned to our competency framework.',
    problem: 'Interview quality varies and preparing kits takes hours.',
    solution: 'Template-driven generation reviewed by the recruiter before use.',
    benefits: 'Fairer, more consistent interviews.',
    ownerId: 'u-ella', contributorIds: ['u-hana'], departmentId: 'd-people', status: 'idea',
    technologies: ['Claude'], tags: ['hiring'],
    proposedAt: ago(3), created: 3, updated: 3, visibility: 'draft',
    journey: { idea: { note: 'Early draft — still shaping the idea.', date: ago(3) } },
  },
  {
    id: 'p-campaign-art', name: 'Campaign Concept Boards', tagline: 'Explore visual directions before the brief is final',
    description: 'Generates mood boards and rough concept art from a campaign brief to speed up creative kick-offs.',
    problem: 'Early creative exploration takes days before anyone can react to visuals.',
    solution: 'Image generation with brand guardrails and a shared board for feedback.',
    benefits: 'Faster alignment at kick-off.',
    ownerId: 'u-zoe', contributorIds: ['u-mira', 'u-nina'], departmentId: 'd-design', status: 'prototype',
    technologies: ['Image generation', 'Figma'], tags: ['brand', 'creative'],
    proposedAt: ago(30), created: 30, updated: 8,
    journey: {
      idea: { note: 'Shared at the creative guild.', date: ago(30) },
      research: { note: 'Agreed brand guardrails with marketing.', date: ago(19) },
      prototype: { note: 'Boards generated for the spring campaign.', date: ago(8) },
    },
  },
  {
    id: 'p-churn', name: 'Early Churn Signals', tagline: 'Spot at-risk accounts weeks earlier',
    description: 'Combines product usage, ticket sentiment and billing events into a weekly at-risk list for account managers.',
    problem: 'We learn an account is unhappy when they cancel.',
    solution: 'Risk scoring model with a plain-language reason for every flagged account.',
    benefits: 'More saves and better-timed outreach.',
    ownerId: 'u-dev', contributorIds: ['u-priya', 'u-sam'], departmentId: 'd-sales', status: 'research',
    technologies: ['Python', 'SQL', 'Claude'], tags: ['retention', 'analytics'], visibility: 'restricted', allowedIds: ['u-ravi'],
    proposedAt: ago(16), created: 16, updated: 2,
    journey: {
      idea: { note: 'Requested by account management leadership.', date: ago(16) },
      research: { note: 'Joining usage and ticket data; restricted while data access is reviewed.', date: ago(2) },
    },
  },
  {
    id: 'p-meeting-notes', name: 'Meeting Notes to Actions', tagline: 'Turn any meeting into owners and deadlines',
    description: 'Summarises meeting transcripts into decisions, owners and due dates and posts them to the team channel.',
    problem: 'Action items get lost after meetings.',
    solution: 'Transcript summariser with a structured action-item format.',
    benefits: 'Clearer follow-through across teams.',
    ownerId: 'u-ravi', contributorIds: ['u-leo'], departmentId: 'd-eng', status: 'archived',
    technologies: ['Claude'], tags: ['productivity'],
    proposedAt: ago(200), created: 200, updated: 70,
    journey: {
      idea: { note: 'Early experiment from the first AI hack day.', date: ago(200) },
      research: { note: 'Archived — the meeting tool now ships this natively.', date: ago(70) },
    },
  },
];

const projects: Project[] = seeds.map(({ created, updated, ...s }) => ({
  visibility: 'published', featured: false, allowedIds: [], notes: '', ...s,
  createdAt: ago(created), updatedAt: ago(updated, 15),
}));

let n = 0;
const id = (prefix: string) => `${prefix}-${++n}`;

const r = (projectId: string, type: Resource['type'], title: string, description: string, url: string, addedBy: string, days: number): Resource =>
  ({ id: id('r'), projectId, type, title, description, url, addedBy, addedAt: ago(days) });

const resources: Resource[] = [
  r('p-call-eval', 'confluence', 'Project brief & rubric mapping', 'Problem, scope and how each guideline maps to an AI check.', 'https://example.atlassian.net/wiki/spaces/AI/pages/call-eval-brief', 'u-asha', 48),
  r('p-call-eval', 'prototype', 'Scoring prototype', 'Upload a recording and see the drafted evaluation.', 'https://example.com/prototypes/call-eval', 'u-leo', 30),
  r('p-call-eval', 'figma', 'Reviewer workflow designs', 'Side-by-side transcript and rubric layout.', 'https://www.figma.com/file/example-call-eval', 'u-leo', 29),
  r('p-call-eval', 'github', 'call-eval repository', 'Transcription pipeline and grader prompts.', 'https://github.com/example/call-eval', 'u-tomas', 27),
  r('p-call-eval', 'video', 'Two-minute demo', 'Walkthrough of a scored call.', 'https://example.com/videos/call-eval-demo', 'u-asha', 20),
  r('p-call-eval', 'notes', 'Pilot kickoff notes', 'Agreements on sampling and how to compare scores.', 'https://docs.google.com/document/d/example-pilot-notes', 'u-priya', 9),
  r('p-kb-bot', 'confluence', 'Retrieval design', 'Chunking, ranking and citation rules.', 'https://example.atlassian.net/wiki/spaces/AI/pages/kb-bot', 'u-leo', 50),
  r('p-kb-bot', 'live', 'Agent pilot (internal)', 'Ask a question in the pilot workspace.', 'https://example.com/kb-bot', 'u-priya', 4),
  r('p-kb-bot', 'slides', 'Pilot results deck', 'Answer quality and time saved so far.', 'https://docs.google.com/presentation/d/example-kb', 'u-priya', 3),
  r('p-triage', 'github', 'triage-model notebook', 'Training data prep and evaluation.', 'https://github.com/example/ticket-triage', 'u-tomas', 6),
  r('p-triage', 'drive', 'Labelled ticket sample', 'The 2,000-ticket labelling sheet.', 'https://drive.google.com/drive/folders/example-triage', 'u-omar', 25),
  r('p-design-review', 'figma', 'Rules exploration board', 'Common review comments grouped by theme.', 'https://www.figma.com/file/example-review-rules', 'u-mira', 2),
  r('p-design-review', 'notes', 'Design guild discussion', 'What reviewers want automated first.', 'https://docs.google.com/document/d/example-guild', 'u-zoe', 10),
  r('p-forecast', 'live', 'Volume forecast dashboard', 'Weekly forecast by channel.', 'https://example.com/dashboards/volume-forecast', 'u-dev', 18),
  r('p-forecast', 'confluence', 'Model card', 'Data, method, accuracy and limitations.', 'https://example.atlassian.net/wiki/spaces/AI/pages/forecast-model', 'u-dev', 60),
  r('p-forecast', 'github', 'forecasting repo', 'Pipelines and back-tests.', 'https://github.com/example/volume-forecast', 'u-dev', 90),
  r('p-content', 'drive', 'Brand-voice prompt library', 'Approved prompts and examples.', 'https://drive.google.com/drive/folders/example-voice', 'u-nina', 25),
  r('p-content', 'screenshot', 'Sample outputs', 'Posts generated from the October webinar.', 'https://example.com/screens/content-samples', 'u-zoe', 12),
  r('p-versant', 'live', 'Speaking Practice Coach', 'The live practice tool.', 'https://example.com/speaking-coach', 'u-hana', 11),
  r('p-versant', 'confluence', 'Rollout guide', 'How cohorts are enrolled and supported.', 'https://example.atlassian.net/wiki/spaces/AI/pages/speaking-coach', 'u-hana', 12),
  r('p-versant', 'video', 'Learner walkthrough', 'What a practice session looks like.', 'https://example.com/videos/speaking-coach', 'u-asha', 40),
  r('p-code-review', 'github', 'review-action', 'The CI action and prompt.', 'https://github.com/example/review-action', 'u-leo', 20),
  r('p-code-review', 'confluence', 'Guardrails & review guidelines', 'What the assistant comments on, and what it never does.', 'https://example.atlassian.net/wiki/spaces/AI/pages/pr-review', 'u-ravi', 38),
  r('p-campaign-art', 'figma', 'Spring campaign boards', 'Generated directions with team comments.', 'https://www.figma.com/file/example-spring', 'u-zoe', 8),
  r('p-churn', 'confluence', 'Signal definitions', 'Which signals feed the risk score.', 'https://example.atlassian.net/wiki/spaces/AI/pages/churn-signals', 'u-dev', 2),
  r('p-onboard', 'notes', 'Scoping session notes', 'Questions to cover first.', 'https://docs.google.com/document/d/example-onboard', 'u-hana', 7),
];

const u = (projectId: string, authorId: string, days: number, title: string, body: string): Update =>
  ({ id: id('up'), projectId, authorId, date: ago(days, 14), title, body });

const updates: Update[] = [
  u('p-call-eval', 'u-asha', 62, 'Idea proposed', 'Shared the idea after calibration showed a 14-point spread between reviewers.'),
  u('p-call-eval', 'u-tomas', 48, 'Discussion completed', 'Agreed the rubric mapping and which parameters to automate first.'),
  u('p-call-eval', 'u-leo', 30, 'Prototype created', 'Upload a recording, get a drafted evaluation with highlighted evidence.'),
  u('p-call-eval', 'u-asha', 9, 'Testing started', 'Six reviewers are comparing AI drafts with their own scores this month.'),
  u('p-call-eval', 'u-priya', 1, 'Early pilot numbers', 'Drafts match final scores on 81% of parameters; reviewers save ~6 minutes per call.'),
  u('p-kb-bot', 'u-priya', 3, 'Pilot expanded', 'Now live for two support pods. Citation accuracy at 94%.'),
  u('p-kb-bot', 'u-leo', 28, 'Slack prototype ready', 'Agents can ask questions in the pilot channel.'),
  u('p-triage', 'u-omar', 6, 'Prototype at 87% accuracy', 'Most misses are billing vs account questions — adding examples.'),
  u('p-design-review', 'u-mira', 2, 'Research underway', 'Collected 25 frequent review comments to automate first.'),
  u('p-forecast', 'u-dev', 18, 'Launched for weekly planning', 'Leads now plan shifts from the forecast dashboard.'),
  u('p-content', 'u-nina', 4, 'A/B test running', 'Comparing engagement on AI-assisted vs manual posts.'),
  u('p-code-review', 'u-leo', 1, 'Suggestion acceptance at 62%', 'Tuning the prompt to reduce style nitpicks.'),
  u('p-versant', 'u-hana', 11, 'Live for all new joiners', 'First-attempt pass rate up in both pilot cohorts.'),
  u('p-campaign-art', 'u-zoe', 8, 'First boards generated', 'Spring campaign directions are ready for feedback.'),
  u('p-onboard', 'u-hana', 7, 'Scoping with People & Culture', 'Agreeing which handbook sections to start with.'),
  u('p-churn', 'u-dev', 2, 'Data access review', 'Project is restricted while the data review completes.'),
];

const c = (projectId: string, authorId: string, days: number, body: string): Comment =>
  ({ id: id('c'), projectId, authorId, date: ago(days, 16), body });

const comments: Comment[] = [
  c('p-call-eval', 'u-ravi', 8, 'Love this. Could the evidence highlights link straight to the timestamp in the recording?'),
  c('p-call-eval', 'u-asha', 7, 'Yes — that is next on the list after the pilot.'),
  c('p-kb-bot', 'u-omar', 2, 'Would be great for the night queue. Happy to test.'),
  c('p-design-review', 'u-leo', 1, 'I can help with the Figma API side.'),
  c('p-sales-email', 'u-nina', 4, 'The brand-voice prompts from the content studio might help here.'),
];

const activity: Activity[] = [
  ...updates.map((x) => ({ id: id('a'), projectId: x.projectId, actorId: x.authorId, date: x.date, action: `posted an update: ${x.title}` })),
  ...resources.map((x) => ({ id: id('a'), projectId: x.projectId, actorId: x.addedBy, date: x.addedAt, action: `added a resource: ${x.title}` })),
  ...projects.map((x) => ({ id: id('a'), projectId: x.id, actorId: x.ownerId, date: x.createdAt, action: 'created the project' })),
];

const feedback: Feedback[] = [
  { id: id('f'), authorId: 'u-ravi', date: ago(3, 11), page: 'Explore projects', path: '/projects', rating: 'works_well', message: 'The filters make it quick to find what other teams are building.', status: 'new' },
  { id: id('f'), authorId: 'u-omar', date: ago(2, 15), page: 'Resource library', path: '/resources', rating: 'could_be_better', message: 'Would like to sort resources by newest first.', status: 'in_progress' },
  { id: id('f'), authorId: 'u-nina', date: ago(1, 10), page: 'Home', path: '/', rating: 'could_be_better', message: 'A short “how to add a project” guide on the home page would help new people.', status: 'new' },
];

export function buildSeed(): Db {
  return {
    version: DB_VERSION,
    departments, people, projects, resources, updates, comments, activity, feedback,
  };
}
