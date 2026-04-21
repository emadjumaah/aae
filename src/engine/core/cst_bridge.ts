/**
 * Arabic Algebra Engine — CST Bridge
 *
 * Converts an AlgebraToken + ReasoningResult into a CST-style token
 * sequence matching the schema defined in
 * ``cst-poc/docs/two-level-tokenization.md``:
 *
 *   ROOT:<field>   REL:<type>   CMP:<field>:<role>   STR:<marker>   LIT:<kind>:<value>
 *
 * This bridge is what lets the algebra engine contribute data to the
 * CST reasoning-model pipeline without either side adopting the other's
 * internal token format.
 *
 * The mapping is deliberately lossy — it produces the **reasoning-level**
 * CST view (no FEAT:*, no inflection detail), which is exactly what the
 * reasoning tokenizer T_R^ar would emit for the same sentence.
 *
 * Two invariants this bridge enforces (see cst_parity.test.ts):
 *
 *   1. Every emitted `CMP:<field>:<role>` / `ROOT:<field>` uses a field
 *      name from ``CST_FIELDS`` — NEVER a raw AAE resource label.
 *   2. Every emitted ``LIT`` carries a ``<kind>:<value>`` shape, where
 *      the value is lowercased and whitespace-joined with underscores.
 */

import type { AlgebraToken, ReasoningResult } from "./types.js";
import { ALL_ROOT_DATA } from "../data/roots.js";

// ─── CST controlled field vocabulary ──────────────────────────────────────
//
// Source of truth: ``cst-poc/edge/arabic_tokenizer.py::ARABIC_ROOT_TO_FIELD``.
// Anything we emit as a CST semantic field MUST live in this set, otherwise
// AAE output cannot be concatenated with cst-poc tokenizer output for
// joint training.

export const CST_FIELDS = [
  "write",
  "know",
  "speak",
  "think",
  "see",
  "feel",
  "move",
  "give",
  "take",
  "make",
  "destroy",
  "change",
  "exist",
  "time",
  "place",
  "possess",
  "trade",
  "fight",
  "enable",
  "govern",
  "create",
  "force",
  "body",
  "food",
  "nature",
  "weather",
  "animal",
  "plant",
  "color",
  "size",
  "measure",
  "connect",
  "contain",
  "open",
  "hold",
  "hide",
  "gather",
  "send",
  "social",
  "dwell",
  "need",
  "want",
  "decide",
  "fix",
  "rest",
  "person",
  "name",
  "art",
  "science",
  "tech",
  "material",
  "structure",
  "quality",
  "sport",
  "work",
  // Graceful fallback when we cannot classify a resource.
  "other",
] as const;

export type CSTField = (typeof CST_FIELDS)[number];

const CST_FIELD_SET: Set<string> = new Set(CST_FIELDS);

// Each key is a token that can appear inside an AAE resource label
// (e.g. "document / record" → tokens {"document","record"}). The first
// token that hits this map wins. Curated manually; extend freely.
const KEYWORD_TO_CST_FIELD: Record<string, CSTField> = {
  // ── write ────────────────────────────────────────────────────────────
  document: "write",
  documentation: "write",
  record: "write",
  draft: "write",
  edit: "write",
  copy: "write",
  duplicate: "write",
  archive: "write",
  backup: "write",
  script: "write",
  text: "write",
  diagram: "write",

  // ── know ─────────────────────────────────────────────────────────────
  knowledge: "know",
  awareness: "know",
  consciousness: "know",
  comprehension: "know",
  certainty: "know",
  doubt: "know",
  discovery: "know",
  detection: "know",
  examination: "know",
  inspection: "know",
  analysis: "know",
  solution: "know",
  experience: "know",
  experiment: "know",
  trial: "know",
  explanation: "know",
  tutorial: "know",
  research: "know",
  finding: "know",
  result: "know",
  data: "know",

  // ── speak ────────────────────────────────────────────────────────────
  speech: "speak",
  conversation: "speak",
  dialogue: "speak",
  discussion: "speak",
  announcement: "speak",
  advice: "speak",
  debate: "speak",
  argument: "speak",
  answer: "speak",
  alert: "speak",
  notification: "speak",
  broadcast: "speak",
  command: "speak",
  directive: "speak",
  compliment: "speak",
  definition: "speak",
  description: "speak",
  specification: "speak",
  denial: "speak",
  contradiction: "speak",
  statement: "speak",

  // ── think ────────────────────────────────────────────────────────────
  assumption: "think",
  belief: "think",
  ambition: "think",
  ambiguity: "think",
  confidence: "think",
  fantasy: "think",
  faith: "think",
  decision: "decide",
  choice: "decide",
  selection: "decide",

  // ── see ──────────────────────────────────────────────────────────────
  appearance: "see",
  display: "see",
  showcase: "see",
  sight: "see",
  vision: "see",
  observation: "see",
  looking: "see",

  // ── feel ─────────────────────────────────────────────────────────────
  anger: "feel",
  rage: "feel",
  feeling: "feel",
  sentiment: "feel",
  compassion: "feel",
  concern: "feel",
  courage: "feel",
  cruelty: "feel",
  crying: "feel",
  motivation: "feel",
  devotion: "feel",
  dislike: "feel",
  aversion: "feel",
  eagerness: "feel",
  envy: "feel",
  fear: "feel",
  forbearance: "feel",
  forgiveness: "feel",
  happiness: "feel",
  joy: "feel",
  sadness: "feel",
  love: "feel",
  hate: "feel",

  // ── move ─────────────────────────────────────────────────────────────
  arrival: "move",
  ascending: "move",
  coming: "move",
  crawling: "move",
  crossing: "move",
  departure: "move",
  descending: "move",
  dragging: "move",
  escape: "move",
  entry: "move",
  exit: "move",
  falling: "move",
  fleeing: "move",
  floating: "move",
  flow: "move",
  following: "move",
  carrying: "move",
  travel: "move",
  movement: "move",

  // ── give / take ──────────────────────────────────────────────────────
  charity: "give",
  gift: "give",
  donation: "give",
  acquisition: "take",
  intake: "take",
  capture: "take",
  catching: "take",
  deposit: "take",
  download: "take",
  deployment: "take",

  // ── make / create ────────────────────────────────────────────────────
  construction: "make",
  assembly: "make",
  manufacturing: "make",
  creation: "create",
  invention: "create",
  design: "create",
  blueprint: "create",
  development: "create",

  // ── destroy ──────────────────────────────────────────────────────────
  demolition: "destroy",
  destruction: "destroy",
  burning: "destroy",
  death: "destroy",
  defeat: "destroy",
  break: "destroy",
  breaking: "destroy",
  cutting: "destroy",
  expulsion: "destroy",

  // ── change ───────────────────────────────────────────────────────────
  modification: "change",
  evolution: "change",
  condensation: "weather",
  evaporation: "weather",
  decrease: "change",
  extension: "change",
  delay: "change",
  postponement: "change",
  increase: "change",

  // ── exist ────────────────────────────────────────────────────────────
  absence: "exist",
  essence: "exist",
  entity: "exist",
  composition: "exist",
  configuration: "exist",
  control: "exist",
  emptiness: "exist",
  existence: "exist",
  event: "exist",
  presence: "exist",

  // ── time ─────────────────────────────────────────────────────────────
  aging: "time",
  calendar: "time",
  schedule: "time",
  childhood: "time",
  dates: "time",
  endeavor: "time",
  ending: "time",
  evening: "time",
  morning: "time",
  night: "time",
  day: "time",
  week: "time",
  month: "time",
  year: "time",
  first: "time",
  last: "time",
  past: "time",
  future: "time",

  // ── place ────────────────────────────────────────────────────────────
  above: "place",
  back: "place",
  behind: "place",
  below: "place",
  bridge: "place",
  desert: "place",
  direction: "place",
  distance: "place",
  separation: "place",
  earth: "place",
  environment: "place",
  field: "place",
  forest: "place",
  home: "place",
  office: "place",
  location: "place",
  area: "place",
  region: "place",

  // ── possess ──────────────────────────────────────────────────────────
  possession: "possess",
  budget: "possess",
  debt: "possess",
  cost: "possess",
  banking: "possess",
  wealth: "possess",

  // ── trade ────────────────────────────────────────────────────────────
  contract: "trade",
  covenant: "trade",
  delegation: "trade",
  proxy: "trade",
  election: "trade",
  exchange: "trade",
  purchase: "trade",
  sale: "trade",
  transaction: "trade",

  // ── fight ────────────────────────────────────────────────────────────
  army: "fight",
  attack: "fight",
  betrayal: "fight",
  corruption: "fight",
  crime: "fight",
  blame: "fight",
  war: "fight",
  battle: "fight",
  weapon: "fight",

  // ── enable ───────────────────────────────────────────────────────────
  ability: "enable",
  capability: "enable",
  benefit: "enable",
  cooperation: "enable",
  coaching: "enable",
  mentoring: "enable",
  support: "enable",
  permission: "enable",

  // ── govern ───────────────────────────────────────────────────────────
  policy: "govern",
  democracy: "govern",
  constitution: "govern",
  duty: "govern",
  authority: "govern",
  rule: "govern",
  law: "govern",

  // ── force ────────────────────────────────────────────────────────────
  attraction: "force",
  adhesion: "force",
  pressure: "force",
  strength: "force",

  // ── body ─────────────────────────────────────────────────────────────
  belly: "body",
  blood: "body",
  bone: "body",
  chest: "body",
  ear: "body",
  eye: "body",
  face: "body",
  flesh: "body",
  hand: "body",
  head: "body",
  heart: "body",
  leg: "body",
  skin: "body",

  // ── food ─────────────────────────────────────────────────────────────
  bread: "food",
  coffee: "food",
  cooking: "food",
  dough: "food",
  drinking: "food",
  eating: "food",
  fasting: "food",
  meal: "food",
  meat: "food",

  // ── nature ───────────────────────────────────────────────────────────
  air: "nature",
  atom: "nature",
  cell: "nature",
  cloud: "nature",
  dust: "nature",
  dryness: "nature",
  dirt: "nature",
  electricity: "nature",
  energy: "nature",
  fire: "nature",
  water: "nature",
  mountain: "nature",
  river: "nature",
  sea: "nature",
  sky: "nature",
  sun: "nature",
  moon: "nature",
  star: "nature",

  // ── weather ──────────────────────────────────────────────────────────
  boiling: "weather",
  cold: "weather",
  heat: "weather",
  flood: "weather",
  rain: "weather",
  snow: "weather",
  wind: "weather",

  // ── animal ───────────────────────────────────────────────────────────
  ant: "animal",
  bee: "animal",
  bird: "animal",
  camel: "animal",
  cat: "animal",
  cattle: "animal",
  dog: "animal",
  fish: "animal",
  horse: "animal",

  // ── plant ────────────────────────────────────────────────────────────
  flower: "plant",
  tree: "plant",
  fruit: "plant",
  plant: "plant",
  seed: "plant",

  // ── color ────────────────────────────────────────────────────────────
  black: "color",
  blue: "color",
  brown: "color",
  green: "color",
  red: "color",
  white: "color",
  yellow: "color",
  color: "color",

  // ── size ─────────────────────────────────────────────────────────────
  abundance: "size",
  depth: "size",
  digit: "size",
  duality: "size",
  five: "size",
  large: "size",
  small: "size",
  height: "size",
  length: "size",
  width: "size",

  // ── measure ──────────────────────────────────────────────────────────
  balance: "measure",
  calculation: "measure",
  estimate: "measure",
  count: "measure",
  enumeration: "measure",
  division: "measure",
  equality: "measure",
  equivalence: "measure",
  weight: "measure",
  degree: "measure",

  // ── connect ──────────────────────────────────────────────────────────
  agreement: "connect",
  consensus: "connect",
  arrangement: "connect",
  order: "connect",
  attachment: "connect",
  bending: "connect",
  category: "connect",
  taxonomy: "connect",
  compatibility: "connect",
  completion: "connect",
  fulfillment: "connect",
  confirmation: "connect",
  resolution: "connect",
  connection: "connect",
  link: "connect",
  filter: "connect",

  // ── contain ──────────────────────────────────────────────────────────
  covering: "contain",
  enclosure: "contain",
  container: "contain",

  // ── open ─────────────────────────────────────────────────────────────
  closure: "open",
  lock: "open",
  door: "open",
  access: "open",
  opening: "open",

  // ── hide ─────────────────────────────────────────────────────────────
  concealing: "hide",
  blocking: "hide",
  blindness: "hide",

  // ── gather ───────────────────────────────────────────────────────────
  meeting: "gather",
  collection: "gather",
  roundup: "gather",

  // ── send ─────────────────────────────────────────────────────────────
  message: "send",
  delivery: "send",
  communication: "send",
  mail: "send",
  email: "send",

  // ── social ───────────────────────────────────────────────────────────
  celebration: "social",
  civilization: "social",
  company: "social",
  culture: "social",
  cultivation: "social",
  dance: "social",
  family: "social",
  epidemic: "social",
  society: "social",

  // ── dwell ────────────────────────────────────────────────────────────
  bed: "dwell",
  building: "dwell",
  house: "dwell",
  room: "dwell",
  residence: "dwell",

  // ── need ─────────────────────────────────────────────────────────────
  necessity: "need",
  requirement: "need",

  // ── want ─────────────────────────────────────────────────────────────
  desire: "want",
  wish: "want",

  // ── decide ───────────────────────────────────────────────────────────
  // (see `think` block — decision/choice mapped there)

  // ── fix ──────────────────────────────────────────────────────────────
  repair: "fix",
  correctness: "fix",
  maintenance: "fix",

  // ── rest ─────────────────────────────────────────────────────────────
  fatigue: "rest",
  sleep: "rest",
  pause: "rest",

  // ── person ───────────────────────────────────────────────────────────
  brother: "person",
  daughter: "person",
  father: "person",
  mother: "person",
  sister: "person",
  son: "person",
  child: "person",
  man: "person",
  woman: "person",

  // ── name ─────────────────────────────────────────────────────────────
  appellation: "name",
  title: "name",
  label: "name",

  // ── art ──────────────────────────────────────────────────────────────
  cinema: "art",
  decoration: "art",
  drawing: "art",
  fabric: "art",
  music: "art",
  painting: "art",
  poetry: "art",
  song: "art",
  art: "art",

  // ── science ──────────────────────────────────────────────────────────
  chemistry: "science",
  biology: "science",
  physics: "science",
  mathematics: "science",
  math: "science",

  // ── tech ─────────────────────────────────────────────────────────────
  algorithm: "tech",
  application: "tech",
  computing: "tech",
  encryption: "tech",
  engineering: "tech",
  software: "tech",
  hardware: "tech",
  network: "tech",

  // ── material ─────────────────────────────────────────────────────────
  coal: "material",
  copper: "material",
  gold: "material",
  iron: "material",
  silver: "material",
  wood: "material",
  stone: "material",

  // ── structure ────────────────────────────────────────────────────────
  structure: "structure",
  framework: "structure",
  hierarchy: "structure",
  system: "structure",
  shape: "structure",

  // ── quality ──────────────────────────────────────────────────────────
  absolute: "quality",
  acceptance: "quality",
  alertness: "quality",
  badness: "quality",
  clarity: "quality",
  cleanliness: "quality",
  difficulty: "quality",
  ease: "quality",
  error: "quality",
  exception: "quality",
  failure: "quality",
  feature: "quality",
  distinction: "quality",
  goodness: "quality",
  beauty: "quality",

  // ── sport ────────────────────────────────────────────────────────────
  sport: "sport",
  game: "sport",
  competition: "sport",

  // ── work ─────────────────────────────────────────────────────────────
  action: "work",
  activation: "work",
  activity: "work",
  assignment: "work",
  cause: "work",
  effort: "work",
  employment: "work",
  execution: "work",
  task: "work",
  job: "work",
  project: "work",

  // ── extended coverage (pass 2) ───────────────────────────────────────
  // animals
  insect: "animal",
  lion: "animal",
  sheep: "animal",
  wolf: "animal",

  // body
  tongue: "body",
  tooth: "body",
  nose: "body",
  pulse: "body",
  wound: "body",
  sweat: "body",
  soul: "body",
  spirit: "body",
  mind: "body",

  // nature / earth / cosmos
  planet: "nature",
  light: "nature",
  lightning: "weather",
  thunder: "weather",
  gas: "nature",
  magnetism: "nature",
  soil: "nature",
  salt: "nature",
  sand: "nature",
  valley: "place",
  wall: "place",
  roof: "place",
  island: "place",
  mineral: "material",
  oil: "material",
  petroleum: "material",
  honey: "food",

  // place / position
  front: "place",
  left: "place",
  right: "place",
  middle: "place",
  side: "place",
  space: "place",
  surface: "place",
  road: "place",
  landfill: "place",
  hole: "place",

  // social / governance / politics / law
  justice: "govern",
  injustice: "govern",
  legislation: "govern",
  parliament: "govern",
  politics: "govern",
  presidency: "govern",
  republic: "govern",
  ministry: "govern",
  management: "govern",
  institution: "govern",
  party: "social",
  opponent: "fight",
  public: "social",
  people: "social",
  neighbor: "social",
  uncle: "person",
  individual: "person",
  spouse: "person",
  media: "speak",
  press: "speak",
  radio: "speak",
  news: "speak",
  narration: "speak",
  story: "speak",
  memory: "know",
  reference: "know",
  reality: "know",
  meaning: "know",
  information: "know",
  query: "know",
  inference: "know",
  proof: "know",
  verification: "know",
  reasoning: "think",
  logic: "think",
  theory: "know",
  testimony: "speak",
  promise: "speak",
  invitation: "speak",
  whisper: "speak",
  shout: "speak",
  silence: "speak",
  sound: "speak",
  voting: "govern",

  // feel / emotion / virtue
  pain: "feel",
  regret: "feel",
  mercy: "feel",
  piety: "feel",
  hope: "feel",
  aspiration: "feel",
  kindness: "feel",
  generosity: "feel",
  gratitude: "feel",
  humiliation: "feel",
  laughter: "feel",
  mourning: "feel",
  patience: "feel",
  loyalty: "feel",
  miserliness: "feel",
  greed: "feel",
  rudeness: "feel",
  sincerity: "feel",
  welcome: "feel",
  threat: "feel",
  hospitality: "feel",

  // money / property / trade / banking
  loan: "possess",
  rent: "possess",
  rental: "possess",
  compensation: "possess",
  reward: "possess",
  penalty: "possess",
  property: "possess",
  asset: "possess",
  income: "possess",
  earnings: "possess",
  profit: "trade",
  investment: "possess",
  funding: "possess",
  capital: "possess",
  insurance: "possess",
  product: "trade",
  market: "trade",
  campaign: "trade",
  goods: "trade",
  grant: "give",
  poverty: "quality",
  scarcity: "quality",
  value: "measure",
  valuation: "measure",
  appraisal: "measure",

  // quantity / measurement / math
  hundred: "size",
  thousand: "size",
  seven: "size",
  six: "size",
  ten: "size",
  third: "size",
  half: "size",
  totality: "size",
  quantity: "measure",
  level: "measure",
  meter: "measure",
  ratio: "measure",
  measurement: "measure",
  statistics: "measure",
  probability: "measure",
  subtraction: "measure",
  triangle: "measure",
  square: "measure",
  angle: "measure",
  point: "measure",
  rhythm: "measure",
  sequence: "structure",
  lineup: "structure",
  linkage: "connect",
  relation: "connect",
  relating: "connect",
  relativity: "connect",
  similarity: "connect",
  partnership: "connect",
  collaboration: "connect",
  sequence_: "structure",

  // tech / CS / data
  programming: "tech",
  storage: "tech",
  repository: "tech",
  transparency: "tech",

  // art / culture / media
  literature: "art",
  theater: "art",
  melody: "art",
  singing: "art",
  recitation: "art",
  reading: "know",
  sculpture: "art",
  paint: "art",
  image: "art",
  snapshot: "art",

  // work / method / plan / strategy
  plan: "decide",
  strategy: "decide",
  planning: "decide",
  method: "work",
  means: "work",
  style: "work",
  service: "work",
  training: "work",
  practice: "work",
  testing: "know",
  experiment_: "know",
  success: "quality",
  failure_: "quality",
  accomplishment: "work",
  effect: "work",
  goal: "want",
  purpose: "want",
  intention: "want",
  will: "want",
  wanting: "want",
  preference: "want",
  advantage: "want",

  // move / travel
  march: "move",
  migration: "move",
  transfer: "move",
  transplant: "move",
  pilgrimage: "move",
  visiting: "move",
  leading: "move",
  leaving: "move",
  riding: "move",
  running: "move",
  swimming: "move",
  walking: "move",
  jumping: "move",
  rotation: "move",
  rise: "move",
  launch: "move",
  raising: "move",
  pushing: "move",
  throwing: "move",
  passing: "move",
  preceding: "move",
  return: "move",
  rollback: "move",
  reply: "speak",
  response: "speak",
  sending: "send",

  // create / make / build / produce
  generation: "create",
  output: "create",
  form: "create",
  layout: "create",
  foundation: "create",
  foundation_: "create",
  sewing: "make",
  frying: "food",
  grinding: "destroy",
  cutting_: "destroy",
  melting: "change",
  freezing: "weather",
  moisture: "weather",
  evaporation_: "weather",
  pollution: "quality",
  murkiness: "quality",
  simplicity: "quality",
  smooth: "quality",
  softness: "quality",
  hardness: "quality",
  roughness: "quality",
  shortness: "size",
  slowness: "size",
  smallness: "size",
  lightness: "size",
  hugeness: "size",
  greatness: "size",
  newness: "quality",
  importance: "quality",
  significance: "quality",
  possibility: "quality",
  permanence: "quality",
  persistence: "quality",
  unity: "quality",
  uniqueness: "quality",
  particular: "quality",
  special: "quality",
  type: "quality",
  category_: "structure",

  // religion / piety / ritual
  worship: "feel",
  prayer: "feel",
  mosque: "place",
  holiness: "feel",
  revelation: "know",
  repentance: "feel",
  prophecy: "know",
  sin: "quality",
  purification: "fix",

  // security / defense
  protection: "fix",
  shield: "contain",
  guard: "see",
  monitor: "see",
  tracking: "see",
  subscription: "connect",
  permitting: "enable",
  prohibition: "govern",
  restriction: "govern",
  ban: "govern",
  imprisonment: "destroy",
  prison: "place",
  seizure: "take",
  victory: "fight",
  invasion: "fight",
  treachery: "fight",
  rescue: "enable",
  refuge: "place",
  safety: "quality",
  security: "quality",
  soldier: "person",
  registration: "write",
  publication: "write",
  print: "write",
  documentation_: "write",
  interpretation: "know",
  commentary: "speak",
  translation: "speak",
  language: "speak",
  naming: "name",

  // health / medicine / body states
  healing: "fix",
  health: "quality",
  wellness: "quality",
  illness: "feel",
  medicine: "fix",
  remedy: "fix",
  treatment: "fix",
  infection: "feel",
  injection: "fix",
  nutrition: "food",
  nursing: "enable",
  bathing: "fix",
  washing: "fix",
  wiping: "fix",
  cleanliness_: "quality",

  // time
  immediacy: "time",
  urgency_: "time",
  speed: "time",
  waiting: "time",
  waking: "time",
  resting_: "rest",
  patience_: "feel",
  delay_: "time",

  // life / being / misc core
  life: "exist",
  living: "exist",
  livelihood: "possess",
  youth: "person",
  uncle_: "person",
  heredity: "person",
  heritage: "social",
  tradition: "social",
  upbringing: "enable",
  guidance: "speak",
  coaching_: "enable",
  education: "know",
  understanding: "know",
  wisdom: "know",
  ignorance: "know",
  illusion: "know",
  imagination: "think",
  meditation: "think",
  intention_: "want",

  // food / drink
  tea: "food",
  sugar: "food",
  rice: "food",
  wheat: "food",
  onion: "food",
  hunger: "food",
  thirst: "food",
  milking: "food",
  milk: "food",

  // domestic / furniture
  chair: "material",
  furniture: "material",
  clothing: "material",
  paint_: "art",
  decoration_: "art",

  // process verbs / actions
  plowing: "work",
  planting: "plant",
  harvest: "plant",
  grazing: "animal",
  hunting: "fight",
  catching_: "take",
  placing: "make",
  wrapping: "contain",
  hiding_: "hide",
  gaze: "see",
  glimpse: "see",
  point_: "see",

  // commerce / transaction
  obtaining: "take",
  obligation: "govern",
  guarantee: "possess",
  inability: "quality",
  independence: "govern",
  freedom: "govern",
  genetics: "science",
  refinement: "quality",
  renewal: "change",
  update: "change",
  transformation: "change",
  removal: "destroy",
  removing: "destroy",
  rent_: "possess",
  ugliness: "quality",
  loss: "destroy",
  deficit: "destroy",
  weakness: "quality",

  // audio / smell / sense
  audio: "speak",
  listening: "speak",
  smell: "see",
  taste: "food",
  touch: "body",
  gaze_: "see",

  // miscellaneous nouns
  chaos: "structure",
  mosque_: "place",
  laziness: "feel",
  fatigue_: "rest",
  clothing_: "material",
  garment: "material",
  root: "plant",
  leaf: "plant",
  attribute: "quality",
  conclusion_: "decide",
  critique: "speak",
  review: "speak",
  example: "know",
  model: "know",
  excavation: "work",
  falsehood: "quality",
  truth: "quality",
  authenticity: "quality",
  trick: "quality",
  sincerity_: "quality",
  indication: "speak",
  inclusion: "contain",
  import: "take",
  evidence: "know",
  proof_: "know",
  reasoning_: "think",
  means_: "work",
  method_: "work",
  nothingness: "exist",
  vanishing: "destroy",
  start: "time",
  session: "gather",
  seat: "dwell",
  scope: "measure",
  space_: "place",
  spacious: "size",
  present: "time",
  preceding_: "time",
  guidance_: "speak",
  greatness_: "size",
  narrowness: "size",
  nearness: "place",
  secret: "hide",
  classified: "hide",
  proximity: "place",
  approach: "place",
  relating_: "connect",
  standing: "exist",
  stopping: "rest",
  lying: "quality",
  lowering: "move",
  petroleum_: "material",
  sinking: "move",
  trick_: "think",
  treatment_: "fix",
  occurrence: "exist",
  occurrence_: "exist",
  testing_: "know",
  leading_: "move",
  landfill_: "place",
  raising_: "move",
  retirement: "rest",
  saved: "possess",
  sending_: "send",
  victim: "person",
  warning: "speak",
};

/**
 * Normalise any AAE resource label (e.g. ``"document / record"``) or
 * single keyword to one of the controlled ``CST_FIELDS``.
 *
 * Returns ``"other"`` when nothing in the resource string maps to a
 * known CST field. Exported so parity tests can assert coverage.
 */
export function cstFieldForResource(resource: string): CSTField {
  // Split on any non-word character and test each token in order.
  const tokens = resource
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);

  for (const t of tokens) {
    const hit = KEYWORD_TO_CST_FIELD[t];
    if (hit) return hit;
    // A bare token that already matches a CST field name → accept it.
    if (CST_FIELD_SET.has(t)) return t as CSTField;
  }
  return "other";
}

// ─── Semantic-field derivation ────────────────────────────────────────────

/**
 * Resolve the CST semantic field for an Arabic root. We consult
 * ``ALL_ROOT_DATA`` (the engine's curated domain labels) and map the
 * ``resource`` label onto the controlled CST vocabulary. Unknown roots
 * fall through to ``"other"`` so the caller never sees a malformed token.
 */
function deriveField(arabicRoot: string): CSTField {
  const rd = ALL_ROOT_DATA.find((r) => r.arabic === arabicRoot);
  if (!rd) return "other";
  return cstFieldForResource(rd.resource);
}

// ─── Pattern → CMP role ──────────────────────────────────────────────────

const PATTERN_TO_CMP_ROLE: Record<string, string> = {
  agent: "agent",
  patient: "patient",
  place: "place",
  instance: "instance",
  plural: "group",
  seek: "request",
  mutual: "reciprocal",
  process: "process",
  intensifier: "intensive",
  causer: "causer",
};

// ─── Intent → REL / STR marker ───────────────────────────────────────────
//
// Most intents map into an implicit relation on the root (seek → REL:for,
// ask → STR:question, etc.). We only emit markers where the intent
// carries truth-conditional information the reasoning level cares about.

const INTENT_TO_MARKER: Record<string, string> = {
  ask: "STR:question",
  // Other intents are encoded via the CMP role / context; we don't emit
  // an extra REL for "do", "send", etc. to keep the sequence coarse.
};

// ─── Negation / conditional / tense markers ──────────────────────────────

function negationToken(neg: AlgebraToken["negation"]): string | null {
  if (!neg) return null;
  return "REL:neg";
}

function conditionalToken(cond: AlgebraToken["conditional"]): string | null {
  if (!cond) return null;
  return "STR:conditional";
}

function tenseToken(tense: AlgebraToken["tense"]): string | null {
  if (!tense) return null;
  if (tense.tense === "future") return "STR:future";
  if (tense.tense === "past") return "STR:past";
  return null;
}

function emphasisToken(emph: AlgebraToken["emphasis"]): string | null {
  // Reasoning level deliberately drops emphasis — see
  // cst-poc/reasoning/tokenizer/projection.py._AR_REMAP.
  void emph;
  return null;
}

// ─── Conjunctions → REL:* ────────────────────────────────────────────────

function conjunctionToken(conj: string): string {
  // Normalise a small set; anything else → REL:and.
  const table: Record<string, string> = {
    and: "REL:and",
    or: "REL:or",
    but: "REL:contrast",
    then: "REL:then",
    because: "REL:cause",
  };
  return table[conj.toLowerCase()] ?? "REL:and";
}

// ─── Preposition → REL:* ─────────────────────────────────────────────────

function prepositionToken(prep: string): string {
  const table: Record<string, string> = {
    in: "REL:in",
    on: "REL:on",
    with: "REL:with",
    for: "REL:for",
    by: "REL:by",
    from: "REL:from",
    to: "REL:to",
    about: "REL:about",
  };
  return table[prep.toLowerCase()] ?? `REL:${prep.toLowerCase()}`;
}

// ─── Modifier → LIT:<kind>:<value> ────────────────────────────────────────
//
// Modifiers from the encoder arrive as ``"key:value"`` where
// ``key ∈ {time, target, topic, content, urgency, unresolved}`` (see
// ``encoder.ts::MODIFIER_PATTERNS``). At the reasoning level CST expects
// ``LIT:<kind>:<normalised-value>`` where ``<kind>`` is one of a small
// closed set. We map AAE modifier keys onto those kinds:
//
//   time       → LIT:time:<val>      (temporal expression)
//   urgency    → LIT:urgency:<val>   (urgent / asap / …)
//   topic      → LIT:topic:<val>     (subject matter of the action)
//   content    → LIT:content:<val>   (object being written/produced)
//   target     → LIT:ref:<val>       (person / team / org the action targets)
//   unresolved → LIT:ref:<val>       (unknown noun phrase)
//   bare       → LIT:ref:<val>       (modifier without a key)
//
// Numeric values in any modifier also emit ``LIT:num:<digits>`` so the
// reasoning model sees a normalised numeric literal.

const MODIFIER_KEY_TO_LIT_KIND: Record<string, string> = {
  time: "time",
  urgency: "urgency",
  topic: "topic",
  content: "content",
  target: "ref",
  unresolved: "ref",
};

const LIT_STRIP_LEADING = new Set(["the", "a", "an", "ال"]);

function normaliseLitValue(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .trim()
    // collapse any whitespace / punctuation to single underscore
    .replace(/[\s\u060C\u061B\u061F.,;:!?]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!cleaned) return "";
  // Strip leading article token if present.
  const parts = cleaned.split("_");
  if (parts.length > 1 && LIT_STRIP_LEADING.has(parts[0])) {
    return parts.slice(1).join("_");
  }
  return cleaned;
}

function modifierTokens(mod: string): string[] {
  // Modifiers arrive as "key:value" or bare value.
  const idx = mod.indexOf(":");
  let key: string;
  let value: string;
  if (idx === -1) {
    key = "";
    value = mod;
  } else {
    key = mod.slice(0, idx);
    value = mod.slice(idx + 1);
  }
  const normalised = normaliseLitValue(value);
  if (!normalised) return [];

  const out: string[] = [];
  const kind = MODIFIER_KEY_TO_LIT_KIND[key] ?? "ref";
  out.push(`LIT:${kind}:${normalised}`);

  // If the value contains a plain integer, also emit a num literal.
  const numMatch = value.match(/(?:^|\D)(\d+)(?:\D|$)/);
  if (numMatch) {
    out.push(`LIT:num:${numMatch[1]}`);
  }
  return out;
}

// ─── Main bridge ─────────────────────────────────────────────────────────

export interface CSTSequence {
  /** Reasoning-level CST tokens for this algebra token */
  tokens: string[];
  /** Semantic field derived from the root (always a `CST_FIELDS` member) */
  field: CSTField;
  /** CMP role derived from the pattern */
  role: string | null;
}

/**
 * Convert an AlgebraToken + optional ReasoningResult into a coarse
 * reasoning-level CST token sequence.
 */
export function toCST(
  token: AlgebraToken,
  _reasoning?: ReasoningResult,
): CSTSequence {
  const out: string[] = ["[BOS]"];

  // 1. Sentence-level markers (come first)
  const tenseTok = tenseToken(token.tense);
  if (tenseTok) out.push(tenseTok);

  const condTok = conditionalToken(token.conditional);
  if (condTok) out.push(condTok);

  const intentMarker = INTENT_TO_MARKER[token.intent];
  if (intentMarker) out.push(intentMarker);

  // 2. Negation before the core token
  const negTok = negationToken(token.negation);
  if (negTok) out.push(negTok);

  // 3. Conjunctions (collected from the token, if any)
  for (const c of token.conjunctions ?? []) {
    out.push(conjunctionToken(c.type ?? "and"));
  }

  // 4. Prepositions → REL:*
  for (const p of token.prepositions ?? []) {
    out.push(prepositionToken(p.prep));
  }

  // 5. Core token: CMP if the pattern gives a role, else ROOT
  const field = deriveField(token.root);
  const role = PATTERN_TO_CMP_ROLE[token.pattern] ?? null;
  if (role) {
    out.push(`CMP:${field}:${role}`);
  } else {
    out.push(`ROOT:${field}`);
  }

  // 6. Modifiers → LIT:<kind>:<value>
  for (const mod of token.modifiers ?? []) {
    for (const tok of modifierTokens(mod)) out.push(tok);
  }

  // 7. Emphasis (currently dropped at reasoning level)
  const emTok = emphasisToken(token.emphasis);
  if (emTok) out.push(emTok);

  out.push("[EOS]");

  return { tokens: out, field, role };
}
