let projectId = null;
let questionIndex = 0;
let questionQueue = [];
let askedQuestionKeys = new Set();
let activeStage = 1;
let maxUnlockedStage = 1;
let intakeStep = 1;
const interviewAnswers = {};
const $ = (selector) => document.querySelector(selector);
function setStage(stage, unlock = false) {
  activeStage = stage;
  if (unlock) maxUnlockedStage = Math.max(maxUnlockedStage, stage);
  document.querySelectorAll(".stage-content").forEach((section) => {
    section.classList.toggle("stage-hidden", Number(section.dataset.stage) !== activeStage);
  });
  document.querySelectorAll(".step").forEach((step) => {
    const stepNumber = Number(step.dataset.goStage);
    step.classList.toggle("active", stepNumber === activeStage);
    step.classList.toggle("complete", stepNumber < maxUnlockedStage);
    step.disabled = stepNumber > maxUnlockedStage;
    if (stepNumber === activeStage) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  });
  if (stage > 1) document.querySelector(".steps").scrollIntoView({ behavior: "smooth", block: "start" });
}
const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
const INTERVIEW_QUESTION_LIMIT = 8;
function selectedServiceLine() { return document.querySelector('input[name="serviceLine"]:checked')?.value || "Healthcare"; }
function projectFunctionality() { return `${selectedServiceLine()} — ${$("#functionality").value.trim()}`; }
function renderIntakeStep() {
  document.querySelectorAll("[data-intake-page]").forEach((page) => page.classList.toggle("is-hidden", Number(page.dataset.intakePage) !== intakeStep));
  document.querySelectorAll("[data-intake-indicator]").forEach((item) => {
    const step = Number(item.dataset.intakeIndicator);
    item.classList.toggle("active", step === intakeStep);
    item.classList.toggle("complete", step < intakeStep);
  });
  $("#intakeBack").disabled = intakeStep === 1;
  $("#intakeContinue").classList.toggle("is-hidden", intakeStep === 3);
  $("#startInterview").classList.toggle("is-hidden", intakeStep !== 3);
  $("#intakeStepLabel").textContent = `Step ${intakeStep} of 3`;
}
function validateIntakeStep() {
  const page = document.querySelector(`[data-intake-page="${intakeStep}"]`);
  const invalidField = [...page.querySelectorAll("[required]")].find((field) => !field.checkValidity());
  if (!invalidField) return true;
  invalidField.reportValidity();
  return false;
}
function updateIntakeReview() {
  $("#intakeReviewWorkflow").textContent = projectFunctionality();
  $("#intakeReviewObjective").textContent = $("#businessObjective").value.trim();
  $("#intakeReviewRoles").textContent = $("#usersRoles").value.trim();
}
const coverageQuestions = [
  { key: "business rules", topic: "Decision rules", prompt: "Which rules, limits, approvals, or eligibility conditions decide whether the workflow can continue?" },
  { key: "exceptions", topic: "Exceptions", prompt: "What should happen for failures, missing information, rejected decisions, or manual overrides? Who owns the resolution?" },
  { key: "data and integrations", topic: "Data and integrations", prompt: "Which data is collected or exchanged, which systems or third parties are involved, and what happens if an integration is unavailable?" },
  { key: "security and compliance", topic: "Privacy and safety", prompt: "Which patient-privacy safeguards, role-based access, audit records, clinical safety checks, and applicable policy requirements must be met?" },
  { key: "service levels and scale", topic: "Care continuity", prompt: "What response times, service hours, availability, downtime procedures, recovery targets, or patient volumes should the service support?" },
  { key: "delivery constraints", topic: "Delivery context", prompt: "What deadlines, budget or team constraints, stakeholder availability, technical dependencies, and change expectations should shape delivery?" },
  { key: "validation and rollout", topic: "Clinical validation and rollout", prompt: "How should clinical and operational users validate this, approve it, pilot it safely, monitor outcomes, and improve it after launch?" },
];
const domainOpeners = [
  { terms: ["appointment", "scheduling", "clinic", "outpatient"], topic: "Appointments", prompt: "For the appointment journey, how does a patient request care, how are urgency and availability handled, and what should the patient and care team be told?" },
  { terms: ["ehr", "record", "clinical data", "patient record"], topic: "Clinical records", prompt: "Which parts of the patient record are created or updated, who may access them, and how should corrections and access history be handled?" },
  { terms: ["medication", "prescription", "pharmacy"], topic: "Medication workflow", prompt: "For the medication workflow, who prescribes, reviews, dispenses, and administers, and what checks or escalations are needed to protect patients?" },
  { terms: ["diagnostic", "lab", "laboratory", "test result", "imaging"], topic: "Diagnostics", prompt: "How is a test or imaging request received, tracked, reviewed, and communicated, including urgent or abnormal results?" },
  { terms: ["discharge", "care plan", "referral", "follow-up"], topic: "Care coordination", prompt: "How are referrals, discharge plans, or follow-ups coordinated across the patient and care team, and how are missed handoffs escalated?" },
  { terms: ["telehealth", "virtual care", "remote monitoring"], topic: "Virtual care", prompt: "How does a patient start a virtual-care session, what happens if the connection or device fails, and when should in-person or urgent care be recommended?" },
  { terms: ["billing", "insurance", "claim", "eligibility"], topic: "Coverage and billing", prompt: "How are coverage, billing, and claim questions handled while keeping clinical decisions and patient care appropriately supported?" },
];

function answerExcerpt(answer) {
  const compact = answer.replace(/\s+/g, " ").trim();
  return compact.length > 150 ? `${compact.slice(0, 147)}...` : compact;
}

function selectOpeningQuestion(context) {
  const opener = domainOpeners.find((rule) => rule.terms.some((term) => context.includes(term)));
  return { key: "workflow and outcomes", ...(opener || { topic: "Workflow", prompt: "Walk through the normal journey. What starts the process, what decisions happen, and what outcome should the user receive?" }) };
}

function selectNextQuestion(previousAnswer) {
  const remaining = coverageQuestions.filter((question) => !askedQuestionKeys.has(question.key));
  if (!remaining.length) return null;
  const answer = previousAnswer.toLowerCase();
  const followUpOrder = [
    { key: "exceptions", terms: ["fail", "error", "reject", "declin", "exception", "manual", "override"] },
    { key: "data and integrations", terms: ["api", "system", "integrat", "third party", "vendor", "data", "document"] },
    { key: "security and compliance", terms: ["risk", "fraud", "security", "audit", "privacy", "compliance", "access"] },
    { key: "business rules", terms: ["rule", "limit", "approv", "eligib", "decision", "threshold"] },
    { key: "service levels and scale", terms: ["volume", "peak", "time", "urgent", "daily", "availability", "customer"] },
  ];
  const followUp = followUpOrder.find((rule) => rule.terms.some((term) => answer.includes(term)));
  const selected = remaining.find((question) => question.key === followUp?.key) || remaining[0];
  const context = previousAnswer ? `You mentioned "${answerExcerpt(previousAnswer)}". ` : "To complete the project picture, ";
  return { ...selected, prompt: `${context}${selected.prompt}` };
}

function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); setTimeout(() => node.classList.remove("show"), 3200); }
async function request(url, options = {}) { const response = await fetch(url, options); if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail || "Request failed"); } return response.json(); }
function displayDocuments(documents, rag) { $("#documentList").innerHTML = documents.map((doc) => `<div class="doc-row"><strong>${escapeHtml(doc.name)}</strong><small>${escapeHtml(doc.source_type || "Project source")} · ${doc.chunks} processed evidence chunks${doc.version ? ` · ${escapeHtml(doc.version)}` : ""}</small></div>`).join(""); $("#ragSummary").innerHTML = `<span>${escapeHtml(rag.vector_database)}</span><span>${escapeHtml(rag.embedding_model)}</span><span>${rag.indexed_chunks} vectors indexed</span>`; $("#documentsPanel").classList.remove("is-hidden"); }
function displayRetrievedEvidence(result) { const list = $("#retrievalResults"); list.innerHTML = result.matches.length ? result.matches.map((match) => `<article class="retrieval-match"><div><span class="field-label">${escapeHtml(match.document_name)} / ${escapeHtml(match.id)}</span><p>${escapeHtml(match.text)}</p></div><strong>${Math.round(match.relevance * 100)}%</strong></article>`).join("") : "<p class=\"muted\">No matching chunks found.</p>"; $("#retrievalCount").textContent = `${result.count} match(es)`; }
function displayRequirements(project) { const list = $("#requirementsList"); list.innerHTML = project.requirements.map((req) => `<article class="requirement"><div class="requirement-head"><div><span class="req-id">${escapeHtml(req.id)}</span><h3>${escapeHtml(req.statement)}</h3><div class="tags">${req.categories.map((category) => `<span class="tag">${escapeHtml(category)}</span>`).join("")}</div></div><select class="status" data-id="${escapeHtml(req.id)}" aria-label="Approval status for ${escapeHtml(req.id)}">${["Draft", "Needs review", "Approved", "Rejected"].map((status) => `<option ${req.approval_status === status ? "selected" : ""}>${status}</option>`).join("")}</select></div><div class="requirement-grid"><div><span class="field-label">Business justification</span><p>${escapeHtml(req.business_justification)}</p></div><div><span class="field-label">Confidence / risk</span><p>${Math.round(req.confidence * 100)}% confidence · ${escapeHtml(req.risk_level)} risk · ${escapeHtml(req.priority)}</p></div><div><span class="field-label">Acceptance criteria</span><p>${req.acceptance_criteria.map(escapeHtml).join("<br>")}</p></div><div><span class="field-label">Reasoning</span><p>${escapeHtml(req.reasoning)}</p></div></div>${req.compliance_mappings?.length ? `<div class="evidence"><span class="field-label">Existing control references</span><p>${req.compliance_mappings.map((mapping) => `${escapeHtml(mapping.control_id)} · ${escapeHtml(mapping.rationale)}`).join("<br>")}</p></div>` : ""}${req.evidence.map((evidence) => `<div class="evidence"><span class="field-label">Evidence · ${escapeHtml(evidence.document_name)} / ${escapeHtml(evidence.chunk_id)}${evidence.source_version ? ` · ${escapeHtml(evidence.source_version)}` : ""}</span><p>${escapeHtml(evidence.excerpt)}${evidence.source_url ? ` <a href="${escapeHtml(evidence.source_url)}" target="_blank" rel="noopener">Official source</a>` : ""}</p></div>`).join("")}</article>`).join(""); $("#requirementCount").textContent = `${project.requirements.length} draft(s) · ${project.risks?.length || 0} reviewable risk(s)`; $("#requirementsPanel").classList.remove("is-hidden"); list.querySelectorAll("select").forEach((select) => select.addEventListener("change", async () => { const data = new FormData(); data.append("status", select.value); try { await request(`/api/projects/${projectId}/requirements/${select.dataset.id}/approval`, { method: "POST", body: data }); toast("Approval status recorded in audit trail."); } catch (error) { toast(error.message); } })); }
function displayIssues(issues, questions = []) { $("#issuesList").innerHTML = `${issues.length ? issues.map((issue) => `<article class="issue"><div><span class="severity">${escapeHtml(issue.severity)}</span><p class="muted">${escapeHtml(issue.check)}</p></div><div><strong>${escapeHtml(issue.requirement_id || "Project")}</strong><p>${escapeHtml(issue.message)}</p><p class="recommendation">${escapeHtml(issue.recommendation)}</p></div></article>`).join("") : "<p class=\"muted\">No rule-based issues found. Human review is still required.</p>"}${questions.length ? `<div class="clarification-queue"><p class="eyebrow">Clarification queue</p>${questions.map((question) => `<p>${escapeHtml(question)}</p>`).join("")}</div>` : ""}`; $("#issueCount").textContent = `${issues.length} issue(s)`; $("#qualityPanel").classList.remove("is-hidden"); }
function displaySdlc(sdlc) { $("#sdlcPanel").classList.remove("is-hidden"); $("#sdlcResult").innerHTML = `<div class="sdlc-overview"><div><p class="eyebrow">Recommended model</p><h3>${escapeHtml(sdlc.recommended_sdlc)}</h3><p>${escapeHtml(sdlc.justification)}</p><div class="interview-actions"><button class="sdlc-decision" data-decision="Approved" type="button">Approve recommendation</button><button class="sdlc-decision quiet-button" data-decision="Needs review" type="button">Return for review</button></div></div><div class="rankings">${sdlc.options.map((option) => `<div class="ranking"><span>${escapeHtml(option.name)}</span><div class="bar"><span style="width:${option.score}%"></span></div><strong>${option.score}%</strong></div>`).join("")}</div></div><div class="workflow"><p class="eyebrow">SDLC decision factors</p><div class="factor-grid">${sdlc.factors.map((factor) => `<div class="factor"><h4>${escapeHtml(factor.name)}</h4><strong>${escapeHtml(factor.value)}</strong><p>${escapeHtml(factor.rationale)}</p>${factor.requirement_ids.length ? `<small>Linked: ${escapeHtml(factor.requirement_ids.join(", "))}</small>` : ""}</div>`).join("")}</div></div><div class="workflow"><p class="eyebrow">Project-specific workflow</p><div class="workflow-grid">${sdlc.workflow.map((phase) => `<div class="phase"><h4>${escapeHtml(phase.phase)}</h4><p>${escapeHtml(phase.activities.join(" · "))}</p><p><strong>Gate:</strong> ${escapeHtml(phase.gate)}</p></div>`).join("")}</div></div>`; document.querySelectorAll(".sdlc-decision").forEach((button) => button.addEventListener("click", async () => { const data = new FormData(); data.append("status", button.dataset.decision); try { await request(`/api/projects/${projectId}/sdlc/approval`, { method: "POST", body: data }); toast(`SDLC decision recorded: ${button.dataset.decision}.`); } catch (error) { toast(error.message); } })); }
function renderQuestion() { const question = questionQueue[questionIndex]; if (!question) { $("#interviewSession").classList.add("is-hidden"); $("#interviewComplete").classList.remove("is-hidden"); $("#interviewSummary").textContent = `${Object.keys(interviewAnswers).length} responses are ready to become searchable project evidence.`; return; } $("#questionProgress").textContent = `Question ${questionIndex + 1} of ${INTERVIEW_QUESTION_LIMIT}`; $("#answerCount").textContent = `${Object.keys(interviewAnswers).length} answers saved`; $("#questionTopic").textContent = question.topic; $("#interviewQuestion").textContent = question.prompt; $("#interviewAnswer").value = interviewAnswers[question.key] || ""; $("#interviewAnswer").focus(); }
function advanceInterview(saveAnswer) { const question = questionQueue[questionIndex]; const answer = $("#interviewAnswer").value.trim(); if (saveAnswer && !answer) { toast("Add an answer or choose Skip for now."); return; } if (answer) interviewAnswers[question.key] = answer; if (questionQueue.length < INTERVIEW_QUESTION_LIMIT) { const nextQuestion = selectNextQuestion(answer); if (nextQuestion) { askedQuestionKeys.add(nextQuestion.key); questionQueue.push(nextQuestion); } } questionIndex += 1; renderQuestion(); }

$("#interviewStartForm").addEventListener("submit", (event) => event.preventDefault());
$("#intakeContinue").addEventListener("click", () => { if (!validateIntakeStep()) return; if (intakeStep === 2) updateIntakeReview(); intakeStep = Math.min(3, intakeStep + 1); renderIntakeStep(); });
$("#intakeBack").addEventListener("click", () => { intakeStep = Math.max(1, intakeStep - 1); renderIntakeStep(); });
$("#startInterview").addEventListener("click", () => { if (!validateIntakeStep()) return; const objective = $("#businessObjective").value.trim(); const users = $("#usersRoles").value.trim(); interviewAnswers["business objective"] = objective; interviewAnswers["users and roles"] = users; const openingQuestion = selectOpeningQuestion(`${projectFunctionality()} ${objective} ${users}`.toLowerCase()); questionQueue = [openingQuestion]; askedQuestionKeys = new Set([openingQuestion.key]); questionIndex = 0; $("#interviewStartForm").classList.add("is-hidden"); $("#interviewSession").classList.remove("is-hidden"); renderQuestion(); });
$("#continueInterview").addEventListener("click", () => advanceInterview(true));
$("#skipInterviewQuestion").addEventListener("click", () => advanceInterview(false));
$("#createProject").addEventListener("click", async () => { const button = $("#createProject"); button.disabled = true; try { const data = new FormData(); data.append("functionality", projectFunctionality()); data.append("stakeholder_input", JSON.stringify(interviewAnswers)); [...$("#files").files].forEach((file) => data.append("files", file)); const result = await request("/api/projects", { method: "POST", body: data }); projectId = result.project_id; $("#projectState").textContent = "Evidence ready"; $("#savedFunctionality").textContent = projectFunctionality(); $("#savedObjective").textContent = $("#businessObjective").value.trim(); $("#savedRoles").textContent = $("#usersRoles").value.trim(); $("#savedSourceCount").textContent = `${Object.keys(interviewAnswers).length} interview responses · ${$("#files").files.length} uploaded document(s)`; $("#projectContextReview").classList.remove("is-hidden"); $("#interviewComplete").classList.add("is-hidden"); $("#exportLink").href = `/api/projects/${projectId}/export`; $("#exportLink").classList.remove("is-hidden"); displayDocuments(result.documents, result.rag); displayRetrievedEvidence(await request(`/api/projects/${projectId}/retrieval`)); setStage(2, true); toast("Your project evidence is indexed and ready to explore."); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
$("#retrieveButton").addEventListener("click", async () => { if (!projectId) return; const button = $("#retrieveButton"); button.disabled = true; try { const query = $("#retrievalQuery").value.trim() || projectFunctionality(); displayRetrievedEvidence(await request(`/api/projects/${projectId}/retrieval?query=${encodeURIComponent(query)}`)); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
$("#generateButton").addEventListener("click", async () => { if (!projectId) return; const button = $("#generateButton"); button.disabled = true; try { const project = await request(`/api/projects/${projectId}/requirements`, { method: "POST" }); displayRequirements(project); displayIssues(project.quality_issues); $("#projectState").textContent = "Review required"; setStage(3, true); toast("Draft requirements and review findings are ready."); } catch (error) { toast(error.message); } finally { button.disabled = false; } });
async function buildDeliveryPlan(button) { if (!projectId) return; button.disabled = true; try { displaySdlc(await request(`/api/projects/${projectId}/sdlc`, { method: "POST" })); $("#projectState").textContent = "Delivery plan ready"; setStage(4, true); toast("Delivery recommendation is ready for review."); } catch (error) { toast(error.message); } finally { button.disabled = false; } }
document.querySelectorAll(".sdlc-action").forEach((button) => button.addEventListener("click", () => buildDeliveryPlan(button)));
document.querySelectorAll(".step").forEach((step) => step.addEventListener("click", () => setStage(Number(step.dataset.goStage))));
