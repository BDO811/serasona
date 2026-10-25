/** Selected literature supports the research context, not Serasona performance. */
export const SCORE_REFERENCES = {
  acoustics: { title: "Eyben et al. The Geneva Minimalistic Acoustic Parameter Set (GeMAPS) for Voice Research and Affective Computing. IEEE Transactions on Affective Computing, 2016.", url: "https://doi.org/10.1109/TAFFC.2015.2457417" },
  stress: { title: "Pisanski et al. Individual differences in cortisol stress response predict increases in voice pitch during exam stress. Physiology & Behavior, 2016.", url: "https://pubmed.ncbi.nlm.nih.gov/27188981/" },
  anxiety: { title: "Weeks et al. The Sound of Fear: assessing vocal fundamental frequency as a physiological indicator of social anxiety disorder. Journal of Anxiety Disorders, 2012.", url: "https://pubmed.ncbi.nlm.nih.gov/23070030/" },
  mood: { title: "Mundt et al. Vocal acoustic biomarkers of depression severity and treatment response. Biological Psychiatry, 2012.", url: "https://pubmed.ncbi.nlm.nih.gov/22541039/" },
  trauma: { title: "Marmar et al. Speech-based markers for posttraumatic stress disorder in US veterans. Depression and Anxiety, 2019.", url: "https://pubmed.ncbi.nlm.nih.gov/31006959/" },
  fatigue: { title: "Thoret et al. Sleep deprivation detected by voice analysis. PLOS Computational Biology, 2024.", url: "https://pubmed.ncbi.nlm.nih.gov/38315733/" },
  pressure: { title: "Hypertension Screening Using Acoustic Analysis and Machine Learning of Random Speech Samples: A Feasibility Study. Digital Biomarkers, 2025.", url: "https://karger.com/dib/article/9/1/130/929394/Hypertension-Screening-Using-Acoustic-Analysis-and" },
  heart: { title: "Sara et al. Noninvasive Voice Biomarker Is Associated With Incident Coronary Artery Disease Events at Follow-up. Mayo Clinic Proceedings, 2022.", url: "https://pubmed.ncbi.nlm.nih.gov/35341593/" },
  hydration: { title: "Verdolini et al. Dependence of phonatory effort on hydration level. Journal of Speech and Hearing Research, 1994.", url: "https://pubmed.ncbi.nlm.nih.gov/7823546/" },
  airway: { title: "Is insufficient pulmonary air support the cause of dysphonia in chronic obstructive pulmonary disease? Auris Nasus Larynx, 2018.", url: "https://pubmed.ncbi.nlm.nih.gov/29325856/" },
  alcohol: { title: "Pisoni and Martin. Effects of Alcohol on the Acoustic-Phonetic Properties of Speech: Perceptual and Acoustic Analyses. Alcoholism: Clinical and Experimental Research, 1989.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC3512114/" },
  metabolic: { title: "Use of Deep Neural Networks to Predict Obesity With Short Audio Recordings: Development and Usability Study. JMIR AI, 2024.", url: "https://ai.jmir.org/2024/1/e54885/" },
  hormones: { title: "Aydin et al. Voice characteristics associated with polycystic ovary syndrome. Laryngoscope, 2016.", url: "https://pubmed.ncbi.nlm.nih.gov/26700739/" },
  allergy: { title: "Develioglu et al. The effect of medical treatment on voice quality in allergic rhinitis. Indian Journal of Otolaryngology and Head & Neck Surgery, 2013.", url: "https://pubmed.ncbi.nlm.nih.gov/24427691/" },
  cognition: { title: "Fraser, Meltzer and Rudzicz. Linguistic Features Identify Alzheimer’s Disease in Narrative Speech. Journal of Alzheimer’s Disease, 2016.", url: "https://pubmed.ncbi.nlm.nih.gov/26484921/" },
  load: { title: "Prediction of mental effort derived from an automated vocal biomarker using machine learning in a large-scale remote sample. Frontiers in Artificial Intelligence, 2023.", url: "https://www.frontiersin.org/journals/artificial-intelligence/articles/10.3389/frai.2023.1171652/full" },
  impact: { title: "McHenry. Acoustic characteristics of voice after severe traumatic brain injury. Laryngoscope, 2000.", url: "https://pubmed.ncbi.nlm.nih.gov/10892688/" },
  attention: { title: "Barona-Lleo and Fernandez. Hyperfunctional Voice Disorder in Children With Attention Deficit Hyperactivity Disorder (ADHD). A Phenotypic Characteristic? Journal of Voice, 2016.", url: "https://pubmed.ncbi.nlm.nih.gov/25862604/" },
};

type ReferenceId = keyof typeof SCORE_REFERENCES;
interface MeasurementEvidence {
  label: string;
  acoustics: string;
  context: string;
  references: ReferenceId[];
  basis: "Direct research" | "Related research" | "Physiological rationale";
}
export const MEASUREMENT_EVIDENCE: Record<string, MeasurementEvidence> = {
  stress: { label: "Stress", acoustics: "Pitch, pitch variation, intensity and speech timing.", context: "Exam stress research links cortisol responses with pitch changes.", references: ["stress"], basis: "Direct research" },
  anxiety: { label: "Anxiety", acoustics: "Pitch, vocal irregularity, breath support and pauses.", context: "Social threat studies examine vocal differences in social anxiety.", references: ["anxiety"], basis: "Direct research" },
  "mood-disruption": { label: "Mood disruption", acoustics: "Speech rate, pauses, intensity and prosodic variation.", context: "Depression studies examine severity and treatment related voice changes.", references: ["mood"], basis: "Related research" },
  hypervigilance: { label: "Hypervigilance", acoustics: "Prosodic variation, speaking rate, spectral energy and voice quality.", context: "PTSD research found speech markers in veterans.", references: ["trauma"], basis: "Related research" },
  "emotional-destabilization": { label: "Emotional destabilization", acoustics: "Prosody, intensity and timing patterns related to emotional state.", context: "This is a model internal sign. Mood literature supplies related context.", references: ["mood"], basis: "Related research" },
  fatigue: { label: "Fatigue", acoustics: "Spectral modulation, voice quality, prosody and speech timing.", context: "Controlled sleep deprivation research supports changes in voice.", references: ["fatigue"], basis: "Direct research" },
  "elevated-blood-pressure": { label: "Blood pressure pattern", acoustics: "Spectral and prosodic patterns investigated for hypertension screening.", context: "Feasibility studies examine classification from speech.", references: ["pressure"], basis: "Direct research" },
  "cardiovascular-strain": { label: "Cardiovascular strain", acoustics: "Voice quality and spectral patterns studied in cardiovascular populations.", context: "A prospective coronary disease study linked a separate voice biomarker with later events.", references: ["heart"], basis: "Related research" },
  dehydration: { label: "Hydration pattern", acoustics: "Phonatory effort, vocal irregularity and voice quality.", context: "Hydration experiments support an effect on phonation. The provider classifies this sign as investigational.", references: ["hydration"], basis: "Physiological rationale" },
  "airway-obstruction-pattern": { label: "Airway obstruction pattern", acoustics: "Breath support, phrase length, pauses and phonation quality.", context: "COPD studies examine pulmonary support and voice changes.", references: ["airway"], basis: "Direct research" },
  "alcohol-use-pattern": { label: "Alcohol use pattern", acoustics: "Articulation timing, speaking rate and motor coordination.", context: "Controlled intoxication research documents timing changes, with substantial speaker differences.", references: ["alcohol"], basis: "Related research" },
  "substance-use-pattern": { label: "Substance use pattern", acoustics: "Motor speech timing, prosody and vocal quality can change with central nervous system effects.", context: "The provider describes an emerging sign. Alcohol research is adjacent evidence.", references: ["alcohol"], basis: "Related research" },
  "metabolic-load": { label: "Metabolic load", acoustics: "Resonance, spectral patterns and respiratory support.", context: "Published obesity prediction research provides related evidence.", references: ["metabolic"], basis: "Related research" },
  "iron-deficiency": { label: "Iron deficiency pattern", acoustics: "Proposed indirect changes in vocal effort, energy and pauses through fatigue.", context: "The provider classifies this sign as investigational.", references: [], basis: "Physiological rationale" },
  "elevated-androgens": { label: "Androgen related pattern", acoustics: "Pitch and vocal fold vibration characteristics.", context: "A PCOS pilot found laryngeal differences between groups with higher androgens.", references: ["hormones"], basis: "Related research" },
  allergy: { label: "Allergy related pattern", acoustics: "Resonance, voice quality and phonation time.", context: "An allergic rhinitis study found voice improvements after treatment.", references: ["allergy"], basis: "Related research" },
  "dry-mouth": { label: "Dry mouth pattern", acoustics: "Mucosal lubrication, phonatory effort and voice quality.", context: "Hydration research supports a mechanism for phonation changes. This is a model internal, investigational sign.", references: ["hydration"], basis: "Physiological rationale" },
  "cognitive-impairment": { label: "Cognitive impairment pattern", acoustics: "Pauses, speech rate, word finding and language organization.", context: "Narrative speech research in Alzheimer’s disease uses acoustic and linguistic information, often from structured tasks.", references: ["cognition"], basis: "Related research" },
  "cognitive-load": { label: "Cognitive load", acoustics: "Timing and acoustic changes during demanding verbal tasks.", context: "Research predicts mental effort during cognitive testing.", references: ["load"], basis: "Related research" },
  "head-impact": { label: "Head impact pattern", acoustics: "Articulation, timing and vocal perturbation.", context: "A study of severe traumatic brain injury described voice abnormalities.", references: ["impact"], basis: "Related research" },
  "attention-dysregulation": { label: "Attention dysregulation", acoustics: "Vocal effort, timing and prosodic variability.", context: "A pediatric ADHD study examined hyperfunctional voice characteristics.", references: ["attention"], basis: "Related research" },
};
