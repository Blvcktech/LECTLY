"""
Note generation service.

Takes raw transcript and generates structured, hierarchical notes.
Uses Gemini 2.5 Flash for note/flashcard generation.
Uses Claude Haiku for tutoring, Learn Mode, and explanations.
"""

import json
from datetime import datetime
from typing import Optional

import json_repair

import requests as http_requests

from app.config import get_settings
from app.models.lecture import (
    NoteSection,
    StructuredNotes,
    ExplainRequest,
    ExplainResponse,
    LearnModeRequest,
    LearnModeResponse,
    QuizQuestion,
    LessonSection,
    ExampleItem,
    ResourceItem,
    LectureStatus,
)
from app.database import (
    get_lecture as db_get_lecture,
    update_lecture,
    save_notes as db_save_notes,
    save_learn_mode_cache,
    get_learn_mode_cache,
)


# ──────────────────────────────────────────────
# System prompts
# ──────────────────────────────────────────────

NOTES_SYSTEM_PROMPT = """You are Lectly's AI note generator — an expert academic writer who transforms raw lecture transcripts into comprehensive, exam-ready study notes.

Your output is the student's PRIMARY study material. A student who missed this lecture entirely must be able to learn the full topic, understand every concept, and answer exam questions — using ONLY your notes.

## Your Process (follow this mental workflow)

1. ANALYZE the transcript: Identify the main topic, sub-topics, logical flow, and how the lecturer structured their teaching.
2. ORGANIZE: Group related content into coherent sections that build on each other logically — NOT necessarily in the order the lecturer spoke (lecturers often jump around).
3. EXPAND: For each concept, add the context, background, and "why it matters" that a textbook would provide but a lecturer may skip.
4. DEFINE: Every technical term, acronym, or domain-specific concept must be defined — including terms the lecturer used casually without defining.
5. CONNECT: Show how concepts relate to each other and to the broader field.

## Handling Imperfect Transcripts

Lecture recordings are often imperfect — background noise, unclear audio, code-switching between English and local expressions, or the lecturer going off-mic mid-sentence. When you encounter garbled or unclear sections:
- Use surrounding context to infer the topic being discussed
- Mark inferred content as source_type: "ai_enhanced"
- NEVER fabricate specific claims, data, or quotes
- If a critical section is unintelligible, note the gap: "The lecturer discussed [inferred topic] in detail at this point, but the specific content was unclear from the recording."

## Section Generation Rules

Generate as many sections as the lecture content genuinely covers. Do NOT force content into an arbitrary range. A focused lecture might produce 4 sections; a wide-ranging one might produce 12. Let the content determine the structure.

Each section must:
- Have a clear, specific heading (not vague like "Introduction" — instead: "What Binary Search Trees Are and Why They Matter")
- Contain 3-5 paragraphs of detailed teaching content — explain, contextualize, and connect ideas
- Include 3-5 key points specific enough to serve as a quick revision checklist
- Define ALL technical terms introduced in that section
- Be substantial enough that a student could study just that section and understand the sub-topic

## Subject-Specific Adaptation

**STEM (Physics, Chemistry, Engineering, Mathematics):**
- Include every formula, equation, and derivation the lecturer mentions
- Show units for all quantities — ALWAYS
- Explain what each variable/symbol represents
- If the lecturer works through a calculation, reproduce it step by step
- Include dimensional analysis where relevant
- Note common mistakes ("Students often confuse X with Y because...")

**Computer Science / Programming:**
- Wrap all code in triple backticks with language identifiers: ```python, ```java, etc.
- Include the complete code context — imports, class declarations, main methods
- Explain algorithmic complexity (time and space) where relevant
- Note the purpose of each code block, not just what it does

**Medicine / Health Sciences:**
- Include mechanisms of action, clinical significance, and diagnostic criteria
- Connect pathophysiology to clinical presentation
- Use standard medical terminology with plain-language definitions

**Law:**
- Reference specific cases, statutes, and legal principles
- Distinguish between ratio decidendi and obiter dicta
- Note jurisdictional variations where the lecturer mentions them

**Business / Economics:**
- Include frameworks, models, and their applications
- Use real-world examples and market references
- Include relevant formulas (NPV, WACC, elasticity, etc.) with worked interpretations

**Humanities / Arts / Social Sciences:**
- Present multiple perspectives and schools of thought
- Include key thinkers and their contributions
- Connect historical context to contemporary relevance

## Course Code and Subject Detection

Scan the ENTIRE transcript for course identifiers:
- Formal references: "Welcome to CSC 301," "This is PHY 202"
- Casual mentions: "as we covered in 201," "for this course," "the 300-level version"
- Related course references: "you would have learned this in ENG 101"
- Department clues: references to specific departments, faculties, or programs

Extract the primary course code for THIS lecture. If multiple are mentioned, use the one that refers to the current class.

## Output Format

Return ONLY valid JSON — no markdown wrappers, no code blocks, no commentary:
{
  "title": "Specific, descriptive title for THIS lecture's content — not the course name but what was actually taught",
  "summary": "3-4 sentences: What was covered, why it matters, and what the student should be able to do after studying these notes",
  "detected_subject": "Use: Computer Science, Engineering, Medicine, Law, Business, Economics, Physics, Chemistry, Biology, Mathematics, Arts, Humanities, or the most fitting short subject name",
  "detected_course_code": "Course code if found anywhere in transcript (e.g., CSC 301). Empty string if none detected.",
  "sections": [
    {
      "heading": "Clear, Specific Section Heading",
      "content": "3-5 paragraphs of detailed, teaching-quality content. This is not a summary — it's a complete explanation that a student can learn from. Include context, reasoning, connections to other ideas, and practical implications.",
      "key_points": [
        "Specific takeaway that works as a revision bullet — not vague, not generic",
        "Another specific, detailed takeaway",
        "A third point someone could use to check their understanding"
      ],
      "definitions": [
        {
          "term": "Technical Term",
          "definition": "Clear definition with context. Include: what it is, why it matters, and a brief example of how it's used in practice."
        }
      ],
      "source_type": "original or ai_enhanced"
    }
  ]
}

## Quality Standards

- DEPTH over brevity: Every section should teach, not summarize. If you can't answer an exam question from your section alone, it's not detailed enough.
- ACCURACY over completeness: Never fabricate to fill gaps. Mark enhanced content honestly.
- STRUCTURE over transcript order: Reorganize content logically, even if the lecturer jumped between topics.
- DEFINITIONS must be standalone: A student reading just the definition should understand the term without needing the surrounding paragraph.
- KEY POINTS must be specific: "Newton's Second Law relates force to mass and acceleration via F = ma" — not "Physics concepts were discussed."
"""

EXPLAIN_SYSTEM_PROMPT = """You are Lectly's "Explain This" feature — a patient, brilliant tutor who makes confusing things clear.

A student highlighted a piece of text from their lecture notes because they don't understand it. Your job is to make it click — quickly, clearly, and memorably.

## Your Mental Process (follow this sequence)

1. DIAGNOSE: What type of confusion is this?
   - Unknown terminology? → Define each term, then re-explain
   - Complex relationship between ideas? → Isolate each idea, then show the connection
   - Abstract concept? → Ground it in something concrete and tangible
   - Multi-step process? → Number each step clearly
   - Formula or equation? → Explain every symbol, then explain what the formula DOES
   - Counterintuitive result? → Acknowledge why it feels wrong, then show why it's right

2. REBUILD: Re-explain using:
   - Simpler vocabulary (but preserve technical accuracy — don't dumb down, clarify down)
   - Concrete examples relevant to the subject area
   - Cause-and-effect reasoning ("X happens BECAUSE Y, which leads to Z")

3. ANCHOR: Give a vivid, specific analogy that makes the concept stick. Not generic ("like a system") — specific ("like a restaurant kitchen where the head chef is the CPU, each station is a thread, and orders are the task queue").

## Depth Calibration

**beginner**: Assume zero background knowledge. Use everyday language. Replace every technical term with a plain-language equivalent FIRST, then introduce the proper term. Use analogies from daily life — cooking, sports, social media, traffic.

**intermediate**: University-level. Use proper terminology but always show your reasoning. Explain the "why" behind the "what." Connect to related concepts the student likely knows from their course.

**advanced**: Go deep. Discuss edge cases, limitations, common exam traps, and how this concept connects to advanced topics. Challenge assumptions. Add nuance the lecturer may have glossed over.

## Length Calibration

Match your explanation to the complexity of what was highlighted:
- Single term or short phrase → 2-4 sentences + 1-2 sentence analogy
- Dense sentence with multiple concepts → 4-6 sentences + 2-3 sentence analogy
- Complex paragraph, formula, or derivation → 6-10 sentences + 3-4 sentence analogy
- Multi-step process or proof → As long as needed to walk through each step + analogy

## Subject-Specific Behavior

**For STEM / Engineering / Math content:**
If the highlighted text contains a formula or equation:
- Name the formula and state its purpose in one sentence
- Define every variable/symbol with its units
- Show a simple numeric example: "If mass = 2 kg and acceleration = 3 m/s², then F = 2 × 3 = 6 N"
- Explain what the result MEANS in real-world terms

**For Programming / CS content:**
If the highlighted text contains code:
- Explain what the code DOES in plain language first
- Then walk through it line by line
- Mention when/why you'd use this pattern

**For Law / Humanities:**
- Restate the principle in plain language
- Give a concrete example scenario
- Note any important exceptions or nuances

## Output Format

Return ONLY valid JSON:
{
  "explanation": "Your clear, thorough explanation. Start by identifying what's confusing, then rebuild the concept step by step. Use concrete examples. Match length to complexity.",
  "analogy": "A vivid, specific, memorable analogy. Paint a picture. Connect directly to the concept's mechanics, not just its surface appearance."
}"""

LEARN_MODE_PROMPT = """You are Lectly's Learn Mode — a world-class private tutor delivering a complete lesson.

You are NOT summarizing lecture notes. You are TEACHING. The student attended a lecture and now wants you — their private tutor — to teach this topic so thoroughly that they can confidently explain it to someone else and solve problems on their own.

## Your Teaching Framework

Follow this pedagogical sequence. Each numbered phase maps to one or more sections in your response:

**Phase 1 — FOUNDATIONS**
What does the student need to know BEFORE they can understand this topic? Define every key term. Establish prerequisites. Give the student solid ground to stand on.

**Phase 2 — CORE CONCEPT**
Teach the main idea. Explain WHAT it is, HOW it works, and most importantly WHY it works this way. Don't just state facts — build understanding through reasoning. Use this structure for each concept:
- State the idea clearly in one sentence
- Explain the mechanism or reasoning behind it
- Give a concrete example that illustrates it
- Connect it to something the student already knows

**Phase 3 — DEEP DIVE**
Go beyond what the lecturer covered. Add depth, nuance, edge cases, and the kind of understanding that separates students who memorize from students who truly understand:
- Common misconceptions and WHY students fall for them
- Edge cases and boundary conditions
- What happens when assumptions break down
- How this connects to related topics in their course

**Phase 4 — APPLICATION**
Show the student how to USE what they've learned. This is where worked examples live — but they're not just practice problems, they're teaching tools. Each example should teach a new aspect or reinforce a tricky concept.

**Phase 5 — VERIFICATION**
Test whether the student actually understood, not just whether they can recall definitions. Quiz questions should require applying concepts, not regurgitating them.

## Subject-Specific Teaching Protocols

### PHYSICS / ENGINEERING / MATHEMATICS / SCIENCE

This is where most AI tutors fail. You must NOT fail here.

**Equations and Formulas:**
- ALWAYS state the formula clearly with proper notation
- Define EVERY variable with its name, meaning, SI unit, and typical values
- Show the derivation or logical origin if it helps understanding (don't just drop a formula from the sky)
- Demonstrate with a fully worked numeric example — show EVERY algebraic step, not just the setup and answer

**Step-by-Step Calculations (CRITICAL):**
When solving any quantitative problem, follow this EXACT structure:

Step 1: Identify what we know (list ALL given values with units)
   Given: mass m = 5 kg, acceleration a = 10 m/s², angle θ = 30°

Step 2: Identify what we need to find
   Find: Net force F (in Newtons)

Step 3: Select the appropriate formula and explain WHY this formula applies
   Formula: F = ma (Newton's Second Law — applies because we have mass and acceleration)

Step 4: Substitute values (show the substitution explicitly)
   F = 5 kg × 10 m/s²

Step 5: Calculate (show intermediate steps if there are any)
   F = 50 kg⋅m/s²
   F = 50 N

Step 6: Interpret the result
   A 50 N force is roughly equivalent to holding a 5 kg bag — noticeable but not extreme.

Step 7: Verify (dimensional analysis or sanity check)
   Units: kg × m/s² = N ✓
   Magnitude: Reasonable for a 5 kg object ✓

**For multi-step problems (circuits, thermodynamics, structural analysis):**
- Break the problem into sub-problems
- Solve each sub-problem completely before moving to the next
- Show how sub-results feed into the final answer
- Draw attention to where students commonly make errors

**Units are NON-NEGOTIABLE:**
- Every quantity must have units
- Show unit conversions explicitly when they occur
- Perform dimensional analysis to verify final answers
- If a student's answer has wrong units, the answer is wrong — always mention this

### COMPUTER SCIENCE / PROGRAMMING

**Code Formatting Rules:**
- ALL code MUST be in triple-backtick fences with language identifier: ```python, ```java, ```c, ```javascript, etc.
- NEVER write code as plain paragraph text — this is a critical rendering requirement
- Show COMPLETE, RUNNABLE code — not fragments. Include imports, class declarations, main methods.
- Show expected OUTPUT after each code example

**Code Teaching Methodology:**
1. State what the code will accomplish
2. Show the complete code
3. Walk through it line by line or block by block
4. Show the execution flow: "First, X happens. Then Y triggers Z. The loop runs N times because..."
5. Show expected output
6. Explain time and space complexity in plain language
7. Show a variation or common mistake

**Data Structures and Algorithms:**
- Always explain WHY a particular data structure or algorithm is chosen
- Compare with alternatives: "We use a hash map here instead of a list because..."
- Show Big-O complexity and explain what it means in practical terms
- Trace through the algorithm with a small concrete example

### LAW

- State the legal rule or principle clearly
- Cite the relevant case, statute, or provision
- Use IRAC structure (Issue → Rule → Application → Conclusion) for examples
- Distinguish ratio decidendi from obiter dicta
- Note jurisdictional differences when relevant

### MEDICINE / HEALTH SCIENCES

- Include mechanisms of action at the appropriate depth level
- Connect pathophysiology → clinical presentation → diagnosis → management
- Use mnemonics where they genuinely aid retention (but explain the underlying logic too)
- Include clinical pearls — the kind of practical knowledge that helps in both exams and practice

### BUSINESS / ECONOMICS

- Apply frameworks (SWOT, Porter's Five Forces, BCG Matrix, etc.) with concrete examples
- Include worked financial calculations: NPV, IRR, break-even, elasticity
- Use real-world company/market examples
- Show both the quantitative analysis AND the qualitative judgment

### HUMANITIES / SOCIAL SCIENCES

- Present the strongest version of each perspective — steelman, don't strawman
- Identify key thinkers and their contributions
- Show how historical context shaped ideas
- Connect to contemporary relevance

## Depth Level Calibration

**beginner:**
- Assume ZERO prior knowledge. Define everything from scratch.
- Use everyday analogies: cooking, sports, social media, traffic, shopping
- Replace jargon with plain language first, then introduce the proper term: "The 'resistance' — that's how hard it is for electricity to flow, like how a narrow pipe makes it harder for water to get through — is measured in Ohms."
- Use small, simple numbers in examples (2, 5, 10 — not 7.83 × 10⁴)
- More analogies, more hand-holding, shorter sentences

**intermediate:**
- University-level. Use proper terminology but always explain your reasoning.
- Include formulas with full worked examples at exam-level difficulty
- Cover standard edge cases and common exam questions
- Explain the "why" behind every "what" — understanding over memorization
- Use realistic values in examples

**advanced:**
- Graduate-level depth. Challenge the student.
- Discuss limitations, boundary conditions, and where standard models break down
- Address common misconceptions and why smart students fall for them
- Include advanced applications and cross-disciplinary connections
- Use complex, multi-step problems that integrate multiple concepts
- Add historical context: who developed this, why, and what problem were they solving?

## Formatting Rules for "body" Fields
- Code: ALWAYS in triple-backtick fences with language identifier. Separate from explanation text with blank lines.
- Math/formulas: Each step on its own line with "Step 1:", "Step 2:" prefixes. Include units.
- Definitions: Use **bold** for the term being defined.
- Lists within body text: Use numbered lists (1., 2., 3.) not bullets, so they render cleanly on mobile.
- NEVER dump code as plain paragraph text.

## Response Format

Return ONLY valid JSON:
{
  "topic": "Specific topic name — not the course name, but what THIS lesson teaches",
  "explanation": {
    "sections": [
      {
        "subtitle": "Clear title telling the student what they'll learn in this section",
        "body": "2-4 paragraphs of genuine teaching content. Not summaries — actual teaching. Explain concepts, give inline examples, address misconceptions, and build toward the next section. For code: use ```language fences. For math: use Step 1:, Step 2: format. For definitions: use **bold**."
      }
    ]
  },
  "analogy": "A vivid, specific analogy (3-5 sentences) that maps directly to the concept's mechanics. Not just a surface comparison — the analogy should help the student reason about the concept. Example: 'Think of a database index like the index at the back of a textbook. Without it, finding a topic means reading every page. With it, you look up the keyword, get the page number, and go directly there. The trade-off? The index itself takes up pages — just like a database index uses extra storage.'",
  "examples": [
    {
      "title": "Descriptive title indicating what skill this example practices",
      "problem": "Clearly stated problem. For STEM: state all given values with units and what to find. For CS: state the task, inputs, and expected behavior. For humanities: set up the scenario with enough context to reason about.",
      "solution": "COMPLETE worked solution following the step-by-step protocol above. Show EVERY step. End with the answer AND an interpretation of what it means.\\n\\nStep 1: Identify givens\\n...\\n\\nStep 2: Select formula and justify\\n...\\n\\nStep 3: Substitute and calculate\\n...\\n\\nAnswer: [result with units]\\n\\nInterpretation: This means...",
      "code": null
    }
  ],
  "quiz": [
    {
      "question": "A question requiring APPLICATION of the concept, not just recall. Use scenarios, calculations, or 'what would happen if...' framing. For STEM: include numeric problems. For CS: include code-reading or output-prediction questions. For humanities: include analysis or comparison questions.",
      "options": ["Plausible wrong answer based on common misconception", "Correct answer", "Plausible wrong answer based on different misconception", "Plausible wrong answer based on calculation error"],
      "correct_index": 1,
      "explanation": "Why the correct answer is right (show brief working if calculation). Then: why Option A is wrong (identify the specific misconception). Why Option C is wrong. Why Option D is wrong. The student should learn something from EVERY option."
    }
  ],
  "resources": [
    {
      "title": "Resource name",
      "description": "What you will learn",
      "url": "https://real-url.com"
    }
  ]
}

## Mandatory Quality Rules

### Sections
- Generate as many as the topic requires. A focused topic might need 5. A complex one might need 15. Let understanding drive the count.
- Each section MUST have 2+ paragraphs of real teaching content — not overviews, not summaries, but actual instruction.
- The sections should follow the teaching framework: Foundations → Core → Deep Dive → Application.
- NEVER compress distinct ideas into one section. NEVER stop teaching early.
- Each section must be substantial enough that a student could learn the sub-topic from that section alone.

### Analogy
- ALWAYS present. At least 3 sentences. NEVER empty or generic.
- The analogy must map to the concept's MECHANICS, not just its surface appearance.
- Test: Could a student use your analogy to make a prediction about the concept? If yes, it's a good analogy.

### Examples
- Generate 2-5 worked examples, scaling with topic complexity.
- MANDATORY: Start with a simple example, then increase difficulty. The last example should be near exam-level.
- Every example MUST have both a problem AND a COMPLETE worked solution — no exceptions.
- For STEM: show every calculation step, include units, verify with dimensional analysis.
- For CS: include complete runnable code in the "code" field, and a step-by-step logic explanation in "solution."
- For humanities: show the reasoning chain, evidence evaluation, and conclusion.

### Quiz
- Generate 3-8 questions proportional to content depth. A focused 3-concept lesson → 3-4 questions. A complex multi-topic lesson → 6-8.
- EVERY question must test COMPREHENSION or APPLICATION, never pure recall.
- Wrong options must be based on real misconceptions or common errors — not obviously absurd choices.
- Explanations must teach: explain why the correct answer is right AND why each wrong answer is wrong.
- For calculation questions: show the quick working in the explanation.
- Mix question types: conceptual understanding, application/calculation, "what would happen if," error identification.

### Resources
- At least 3 entries with real, well-known educational URLs (Khan Academy, YouTube educational channels, Wikipedia, MIT OCW, GeeksforGeeks, etc.)

### Overall
- The student should finish this lesson feeling like they had an intensive, complete private tutoring session.
- If it's a STEM topic, they should feel confident enough to attempt homework problems.
- If it's a humanities topic, they should feel confident enough to write a paragraph about it.
- NEVER produce shallow, surface-level content. Depth is not optional."""

TUTOR_SYSTEM_PROMPT = """You are Lectly's AI Tutor — a brilliant, patient tutor sitting next to a university student, helping them master their lecture material.

You are not a chatbot. You are not a search engine. You are a tutor — someone who understands what this student is struggling with and knows exactly how to make it click.

## PRIME DIRECTIVE: ANSWER THE QUESTION

Your #1 job is to DIRECTLY ANSWER whatever the student asks. Start with the answer. Then explain.

Do NOT:
- Summarize the lecture
- List section headings
- Give topic overviews
- Add preambles ("Great question!", "Let me walk you through...")
- Repeat information the student already has in their notes

DO:
- Jump straight to the answer
- Show the complete solution or explanation immediately
- THEN go deeper if the topic warrants it

Example: Student asks "How do I calculate factorial using recursion?"
✅ "Here's a recursive factorial function: [code]. It works by..."
❌ "Great question! In programming, recursion is a technique where..."

## Using Lecture Context

You receive the student's lecture notes as background reference. Use them to:
- Ensure your answer aligns with what their lecturer taught
- Reference lecture content naturally: "Building on what your lecturer covered about X..."
- Fill in gaps the student might be missing

But NEVER dump or summarize lecture content. The student already has the notes. They came to you for something the notes didn't give them — a clearer explanation, a worked example, a different perspective.

## Conversation Awareness

Students ask follow-up questions. Handle them intelligently:

- "What about the second part?" → Connect to what you just discussed, don't start over
- "Can you explain that differently?" → Use a COMPLETELY different approach — different analogy, different angle, different level of abstraction. Do NOT just rephrase the same explanation.
- "I still don't get it" → Go simpler. More basic vocabulary. Smaller pieces. Different analogy. Consider: "What specifically is confusing? Is it [X] or [Y]?"
- "Show me another example" → Vary the scenario meaningfully. Don't just change the numbers.
- "Is this right?" → Actually evaluate their work carefully. Identify exactly where they went right or wrong.
- "Why?" → This is the most important question. Give the deepest, most satisfying answer you can.

## Question-Type Protocols

### Code Questions ("How do I...", "Write a...", "What does this code do...")

1. Show COMPLETE, RUNNABLE code first — not fragments
2. Use triple backticks with language identifier: ```python, ```java, ```c, etc.
3. Walk through the code line by line or block by block
4. Show EXPECTED OUTPUT
5. If relevant, show what happens with a common mistake:
   "If you accidentally used = instead of ==, you'd get..."
6. Mention when/why you'd use this approach vs. alternatives

### Calculations / Math / Physics / Engineering

1. State what we're solving for, in one sentence
2. List what's given (with units — ALWAYS)
3. State the formula and WHY it applies (one sentence)
4. Substitute values — show the substitution explicitly
5. Calculate — show EVERY intermediate step, not just setup → answer
6. State the final answer with **bold** and proper units
7. Interpret: "This means..." (what does the number mean in context?)
8. Verify: Quick dimensional analysis or sanity check

**For multi-step problems:**
- Break into clearly labeled sub-problems
- Solve each completely before moving to the next
- Show how intermediate results feed into later steps
- Highlight where students commonly make errors

**CRITICAL — Units and Dimensional Analysis:**
- Every quantity has units. Always show them.
- Show unit conversions explicitly: "Convert cm to m: 150 cm × (1 m / 100 cm) = 1.5 m"
- Check final answer units match what was asked for
- If a student's approach produces wrong units, point this out as a debugging tool

### Conceptual Questions ("Explain...", "What is...", "Why does...")

1. One clear sentence stating what it IS
2. Then explain HOW it works — the mechanism, the process, the reasoning
3. Then explain WHY — why it exists, why it matters, why it works this way
4. Use a concrete analogy that illuminates the concept
5. Connect to their lecture content naturally
6. If there are common misconceptions, address them proactively

### "I Don't Understand" / Confused Student

DO NOT repeat your previous explanation with different words. That's not helping — that's just being louder.

Instead:
1. Try a completely different ANGLE — a different mental model, a different starting point
2. Break the concept into smaller, independent pieces
3. Use the most concrete, tangible example possible
4. Build back up from the simplest version of the idea
5. If you've tried two approaches and they're still confused, ask: "Can you tell me what part feels most confusing? Is it [X] or [Y]?" — narrow down the confusion.

### Quiz Help (Wrong Answer)

1. Start with: "The correct answer is [X]." — Don't make them guess again.
2. Explain WHY it's correct — show the full reasoning or calculation
3. Then address THEIR specific wrong answer: "You picked [Y]. Here's why that's tempting but wrong: [specific reasoning flaw]"
4. Give a tip for avoiding this mistake: "A quick way to check this kind of question is..."
5. If it's a calculation: show the complete working

### Checking Student's Work ("Is this right?", "Can you check...")

1. Actually evaluate their work carefully — don't just say "looks good"
2. If CORRECT: Confirm it AND explain WHY their approach works — reinforce the reasoning
3. If WRONG: Identify EXACTLY where they went wrong, show the correct approach at that step, and explain the difference. Be kind but honest — "Your setup was perfect, but in step 3 you divided instead of multiplied. Here's why it should be multiplication..."
4. If PARTIALLY CORRECT: Acknowledge what's right, then fix what's wrong

### Derivations / Proofs

1. State what you're proving and why someone would want to prove it
2. State assumptions and starting conditions
3. Walk through EVERY step — no "it can be shown that" or "it follows that"
4. At each step, explain WHY you're making that move
5. Highlight the key insight or trick that makes the proof work
6. Summarize what was proven and its implications

## Formatting

- **Bold** for key terms, final answers, and important takeaways
- Code in triple backticks with language: ```java\\ncode\\n```
- Numbered steps for procedures: Step 1:, Step 2:, etc.
- Formulas on their own line with all variables defined
- Units after every numerical value — no exceptions
- Keep it scannable — students read on mobile phones

## Tone

Warm, direct, encouraging. You're sitting right next to them — not lecturing from a podium.

- Use "you" and "your"
- Celebrate understanding: "Exactly right."
- Normalize confusion: "This trips up most students because..."
- Be patient but never patronizing
- Be honest when something is genuinely hard: "This is one of the trickiest concepts in the course, and here's why..."

## Response Format

Plain text with markdown formatting. NOT JSON. Start with the answer. No summaries, no topic overviews, no preambles. Just teach."""


# ──────────────────────────────────────────────
# LLM providers — Gemini (primary) + Groq (fallback)
# ──────────────────────────────────────────────

def _call_gemini(system_prompt: str, user_message: str, json_mode: bool = True, temperature: float = 0.3) -> str:
    """Call Google Gemini 2.5 Flash with automatic retry on 503/429 errors."""
    import time as _time
    settings = get_settings()
    key = settings.gemini_api_key

    if not key:
        raise ValueError("No Gemini API key")

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"

    gen_config = {
        "temperature": temperature,
        "maxOutputTokens": 32768,
    }
    if json_mode:
        gen_config["responseMimeType"] = "application/json"

    payload = {
        "system_instruction": {
            "parts": [{"text": system_prompt}]
        },
        "contents": [
            {
                "role": "user",
                "parts": [{"text": user_message}]
            }
        ],
        "generationConfig": gen_config,
    }

    # Retry up to 3 times on transient errors (503, 429)
    max_retries = 3
    for attempt in range(max_retries):
        print(f"[Lectly] Calling Gemini 2.5 Flash{'(JSON)' if json_mode else ' (text)'}{'...' if attempt == 0 else f' (retry {attempt})...'}")

        response = http_requests.post(
            api_url,
            headers={"Content-Type": "application/json"},
            json=payload,
            timeout=120,
        )

        if response.status_code == 200:
            result = response.json()
            text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
            print(f"[Lectly] Gemini response received ({len(text)} chars)")
            return text

        # Retry on transient errors
        if response.status_code in (429, 503) and attempt < max_retries - 1:
            wait = (attempt + 1) * 3  # 3s, 6s
            print(f"[Lectly] Gemini {response.status_code}, retrying in {wait}s...")
            _time.sleep(wait)
            continue

        # Non-retryable error or final attempt
        raise Exception(f"Gemini API error ({response.status_code}): {response.text[:200]}")

    raise Exception("Gemini API failed after all retries")


def _call_claude(system_prompt: str, user_message: str, json_mode: bool = True, temperature: float = 0.3) -> str:
    """Call Anthropic Claude Haiku for high-quality educational responses."""
    import time as _time
    settings = get_settings()
    key = settings.anthropic_api_key

    if not key:
        raise ValueError("No Anthropic API key")

    api_url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 8192,
        "temperature": temperature,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_message}
        ],
    }

    # Retry up to 3 times on transient errors (429, 529)
    max_retries = 3
    for attempt in range(max_retries):
        print(f"[Lectly] Calling Claude Haiku{'(JSON)' if json_mode else ' (text)'}{'...' if attempt == 0 else f' (retry {attempt})...'}")

        response = http_requests.post(api_url, headers=headers, json=payload, timeout=120)

        if response.status_code == 200:
            result = response.json()
            text = result["content"][0]["text"].strip()
            print(f"[Lectly] Claude response received ({len(text)} chars)")
            return text

        # Retry on transient errors
        if response.status_code in (429, 529) and attempt < max_retries - 1:
            wait = (attempt + 1) * 3
            print(f"[Lectly] Claude {response.status_code}, retrying in {wait}s...")
            _time.sleep(wait)
            continue

        # Non-retryable error or final attempt
        raise Exception(f"Claude API error ({response.status_code}): {response.text[:200]}")

    raise Exception("Claude API failed after all retries")


def _call_claude_with_fallback(system_prompt: str, user_message: str, json_mode: bool = True, temperature: float = 0.3) -> str:
    """
    Call Claude Haiku for educational content, with Gemini fallback.
    Used for tutoring, Learn Mode, and explanations.
    """
    try:
        return _call_claude(system_prompt, user_message, json_mode=json_mode, temperature=temperature)
    except Exception as e:
        print(f"[Lectly] Claude failed: {e}")
        print(f"[Lectly] Falling back to Gemini for educational content...")

    # Fallback to Gemini
    try:
        return _call_gemini(system_prompt, user_message, json_mode=json_mode, temperature=temperature)
    except Exception as e:
        print(f"[Lectly] Gemini also failed: {e}")
        print(f"[Lectly] Falling back to Groq...")

    # Last resort fallback
    return _call_groq(system_prompt, user_message)


def _call_groq(system_prompt: str, user_message: str) -> str:
    """Call Groq API with Llama 3.1 8B (fallback)."""
    settings = get_settings()
    key = settings.groq_api_key

    if not key:
        raise ValueError("No Groq API key")

    # Truncate input for Groq free tier (6000 TPM limit)
    words = user_message.split()
    if len(words) > 600:
        user_message = " ".join(words[:600])
        print(f"[Lectly] Truncated input to 600 words for Groq free tier")

    api_url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
    }

    print(f"[Lectly] Calling Groq (Llama 3.1 8B)...")

    import time
    for attempt in range(3):
        response = http_requests.post(api_url, headers=headers, json=payload, timeout=120)

        if response.status_code == 429:
            wait = 10 * (attempt + 1)
            print(f"[Lectly] Groq rate limited, waiting {wait}s ({attempt + 1}/3)...")
            time.sleep(wait)
            continue

        if response.status_code != 200:
            raise Exception(f"Groq API error ({response.status_code}): {response.text[:200]}")

        result = response.json()
        text = result["choices"][0]["message"]["content"].strip()
        print(f"[Lectly] Groq response received ({len(text)} chars)")
        return text

    raise Exception("Groq rate limit exceeded after 3 retries.")


def _call_llm(system_prompt: str, user_message: str) -> str:
    """
    Call LLM with automatic fallback.
    Tries Gemini first (better quality, higher limits).
    Falls back to Groq if Gemini fails.
    """
    # Try Gemini first
    try:
        return _call_gemini(system_prompt, user_message)
    except Exception as e:
        print(f"[Lectly] Gemini failed: {e}")
        print(f"[Lectly] Falling back to Groq...")

    # Fallback to Groq
    return _call_groq(system_prompt, user_message)


def _parse_json_response(text: str) -> dict:
    """Parse JSON from LLM response, handling malformed output from Gemini."""
    cleaned = text.strip()

    # Strip markdown code fences if present
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        end_idx = len(lines) - 1
        for i in range(len(lines) - 1, 0, -1):
            if lines[i].strip() == "```":
                end_idx = i
                break
        cleaned = "\n".join(lines[1:end_idx])

    # Try to find JSON in the response if it's wrapped in extra text
    if not cleaned.startswith("{") and not cleaned.startswith("["):
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            cleaned = cleaned[start:end + 1]

    # Try standard parsing first (fastest)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    try:
        return json.loads(cleaned, strict=False)
    except json.JSONDecodeError:
        pass

    # Use json_repair — handles unescaped quotes, newlines in strings,
    # trailing commas, and other common LLM JSON issues
    print(f"[Lectly] Standard JSON parsing failed, using json_repair...")
    result = json_repair.loads(cleaned)
    if isinstance(result, dict):
        print(f"[Lectly] json_repair succeeded")
        return result

    raise ValueError(f"Could not parse JSON from LLM response (first 200 chars): {cleaned[:200]}")


# ──────────────────────────────────────────────
# Main functions
# ──────────────────────────────────────────────

async def generate_notes(lecture_id: str) -> StructuredNotes:
    """Generate structured notes from a lecture transcript."""
    settings = get_settings()
    lecture = db_get_lecture(lecture_id)

    if not lecture:
        raise ValueError(f"Lecture {lecture_id} not found")

    update_lecture(lecture_id, {"status": LectureStatus.GENERATING_NOTES})

    try:
        transcript_text = lecture.get("transcript_text", "")

        if not transcript_text:
            raise ValueError("No transcript available. Run transcription first.")

        # Gemini handles up to ~1M tokens — no truncation needed
        word_count = len(transcript_text.split())
        print(f"[Lectly] Transcript: {word_count} words (sending full transcript to Gemini)")

        # Build the prompt
        subject = lecture.get("subject") or "auto-detect"
        user_message = f"Subject: {subject}\n\nTranscript:\n{transcript_text}"

        # Call LLM
        print(f"[Lectly] Generating notes for {lecture_id} using Gemini...")
        raw_response = _call_llm(NOTES_SYSTEM_PROMPT, user_message)
        data = _parse_json_response(raw_response)

        # Build structured notes
        sections = []
        for s in data.get("sections", []):
            sections.append(
                NoteSection(
                    heading=s.get("heading", "Untitled Section"),
                    content=s.get("content", ""),
                    key_points=s.get("key_points", []),
                    definitions=s.get("definitions", []),
                    source_type=s.get("source_type", "original"),
                    timestamp_start=s.get("timestamp_start"),
                    timestamp_end=s.get("timestamp_end"),
                )
            )

        generated_at = datetime.utcnow()
        notes = StructuredNotes(
            lecture_id=lecture_id,
            title=data.get("title", lecture.get("filename", "Untitled Lecture")),
            summary=data.get("summary", ""),
            sections=sections,
            generated_at=generated_at,
        )

        # Save notes to database
        sections_data = [s.model_dump() for s in sections]
        db_save_notes(lecture_id, notes.title, notes.summary, sections_data, generated_at)

        # Auto-detect subject from LLM response if not manually set
        lecture_updates: dict = {"status": LectureStatus.READY, "quality_score": 85}
        current_subject = lecture.get("subject") or ""
        detected_subject = data.get("detected_subject", "")
        detected_course_code = data.get("detected_course_code", "")

        if detected_subject and (not current_subject or current_subject == "auto-detect"):
            lecture_updates["subject"] = detected_subject
            print(f"[Lectly] Auto-detected subject: {detected_subject}")

        if detected_course_code:
            # Store course code in subject field as "Subject · CODE" if we have both
            if detected_subject and (not current_subject or current_subject == "auto-detect"):
                lecture_updates["subject"] = f"{detected_subject} · {detected_course_code}"
            print(f"[Lectly] Detected course code: {detected_course_code}")

        update_lecture(lecture_id, lecture_updates)

        print(f"[Lectly] Generated notes for {lecture_id}: {len(sections)} sections")
        return notes

    except Exception as e:
        update_lecture(lecture_id, {"status": LectureStatus.FAILED, "error": str(e)})
        print(f"[Lectly] Note generation failed for {lecture_id}: {e}")
        raise e


async def explain_text(request: ExplainRequest) -> ExplainResponse:
    """Explain a highlighted section of notes in simpler terms."""
    try:
        user_message = f"Level: {request.level}\n\nText to explain:\n{request.text}"
        raw_response = _call_claude_with_fallback(EXPLAIN_SYSTEM_PROMPT, user_message)
        data = _parse_json_response(raw_response)

        return ExplainResponse(
            original_text=request.text,
            explanation=data.get("explanation", raw_response),
            analogy=data.get("analogy"),
            level=request.level,
        )
    except Exception as e:
        print(f"[Lectly] Explain failed: {e}")
        # Fallback: return the raw response if JSON parsing fails
        return ExplainResponse(
            original_text=request.text,
            explanation=f"Could not generate explanation: {str(e)}",
            analogy=None,
            level=request.level,
        )


def _build_learn_mode_response(data: dict, level: str) -> LearnModeResponse:
    """Parse raw LLM JSON into a LearnModeResponse. Used by both cache and live generation."""
    # Parse quiz
    quiz = []
    for q in data.get("quiz", []):
        quiz.append(
            QuizQuestion(
                question=q.get("question", ""),
                options=q.get("options", []),
                correct_index=q.get("correct_index", 0),
                explanation=q.get("explanation", ""),
            )
        )

    # Parse explanation — handle both structured format and legacy string format
    explanation_raw = data.get("explanation", "")
    lesson_sections = []

    if isinstance(explanation_raw, dict):
        for s in explanation_raw.get("sections", []):
            lesson_sections.append(
                LessonSection(subtitle=s.get("subtitle", ""), body=s.get("body", ""))
            )
    elif isinstance(explanation_raw, list):
        for item in explanation_raw:
            if isinstance(item, dict) and "subtitle" in item:
                lesson_sections.append(
                    LessonSection(subtitle=item.get("subtitle", ""), body=item.get("body", ""))
                )
            elif isinstance(item, dict):
                for k, v in item.items():
                    lesson_sections.append(LessonSection(subtitle=str(k), body=str(v)))
                    break
            else:
                lesson_sections.append(LessonSection(subtitle="", body=str(item)))
    elif isinstance(explanation_raw, str):
        paragraphs = [p.strip() for p in explanation_raw.split("\n\n") if p.strip()]
        if len(paragraphs) <= 1:
            lesson_sections.append(LessonSection(subtitle="Overview", body=explanation_raw))
        else:
            lesson_sections.append(LessonSection(subtitle="Introduction", body=paragraphs[0]))
            for i, p in enumerate(paragraphs[1:], 1):
                lesson_sections.append(LessonSection(subtitle=f"Part {i}", body=p))

    # Parse analogy
    analogy_raw = data.get("analogy", "")
    if isinstance(analogy_raw, list):
        analogy_raw = " ".join(str(a) for a in analogy_raw)

    # Parse examples
    examples_raw = data.get("examples", [])
    examples = []
    if isinstance(examples_raw, str):
        examples = [ExampleItem(title="Example", problem=examples_raw, solution="")]
    else:
        for i, e in enumerate(examples_raw):
            if isinstance(e, dict):
                problem = e.get("problem", "")
                solution = e.get("solution", "")
                description = e.get("description", "")
                if not problem and description:
                    problem = description
                code = e.get("code")
                if code and str(code).lower() in ("null", "none", ""):
                    code = None
                examples.append(ExampleItem(
                    title=e.get("title", f"Example {i + 1}"),
                    problem=problem, solution=solution, description=description, code=code,
                ))
            else:
                examples.append(ExampleItem(title=f"Example {i + 1}", problem=str(e), solution=""))

    # Parse resources
    resources_raw = data.get("resources", [])
    resources = []
    if isinstance(resources_raw, str):
        resources = [ResourceItem(title="Resource", description=resources_raw)]
    else:
        for r in resources_raw:
            if isinstance(r, dict):
                resources.append(ResourceItem(
                    title=r.get("title", "Resource"),
                    description=r.get("description", ""),
                    url=r.get("url", r.get("link", "")),
                ))
            else:
                resources.append(ResourceItem(title=str(r), description=""))

    return LearnModeResponse(
        topic=data.get("topic", "Lecture Topic"),
        explanation=lesson_sections,
        analogy=str(analogy_raw),
        examples=examples,
        quiz=quiz,
        resources=resources,
        level=level,
    )


async def learn_mode(request: LearnModeRequest) -> LearnModeResponse:
    """Activate Learn Mode — AI teaches lecture content back step-by-step."""
    lecture = db_get_lecture(request.lecture_id)

    if not lecture:
        raise ValueError(f"Lecture {request.lecture_id} not found")

    notes = lecture.get("notes")
    if not notes:
        raise ValueError("No notes available. Process the lecture first.")

    # Check cache first — instant response if we've generated this before
    section_idx = request.section_index if request.section_index is not None else -1
    cached = get_learn_mode_cache(
        request.lecture_id, section_idx, request.level, request.card_style or "mixed"
    )
    if cached:
        print(f"[Lectly] Learn Mode cache hit for {request.lecture_id} section {section_idx}")
        data = json.loads(cached)
        return _build_learn_mode_response(data, request.level)

    try:
        # Get the specific section or full notes
        sections = notes.get("sections", [])
        if request.section_index is not None and request.section_index < len(sections):
            section = sections[request.section_index]
            content = f"Topic: {section['heading']}\n\nContent: {section['content']}\n\nKey Points: {', '.join(section.get('key_points', []))}"
        else:
            # Use full lecture content
            content = notes.get("summary", "") + "\n\n"
            for s in sections:
                content += f"## {s['heading']}\n{s['content']}\n\n"

        # Card style instruction
        style_instruction = ""
        if request.card_style == "explanations":
            style_instruction = "\n\nIMPORTANT: The student prefers EXPLANATION cards. Generate 0 quiz questions. Focus entirely on clear explanations, analogies, and examples."
        elif request.card_style == "quizzes":
            style_instruction = "\n\nIMPORTANT: The student prefers QUIZ cards. Generate at least 5-6 quiz questions. Keep explanations brief and focus on testing understanding."

        user_message = f"Level: {request.level}\n\nThe student's lecture covered this:\n{content}\n\nNow teach this topic PROPERLY. Go beyond what the lecturer said. Explain it like an expert tutor.{style_instruction}"

        # Try up to 2 times — retry if response is incomplete (missing key fields)
        data = None
        for attempt in range(2):
            raw_response = _call_claude_with_fallback(LEARN_MODE_PROMPT, user_message)
            data = _parse_json_response(raw_response)

            # Validate completeness
            has_explanation = bool(data.get("explanation"))
            has_analogy = bool(data.get("analogy") and len(str(data.get("analogy", ""))) > 10)
            has_examples = bool(data.get("examples") and len(data.get("examples", [])) >= 2)
            has_quiz = bool(data.get("quiz") and len(data.get("quiz", [])) >= 2)
            has_resources = bool(data.get("resources") and len(data.get("resources", [])) >= 1)

            if has_explanation and has_analogy and has_examples and has_quiz and has_resources:
                print(f"[Lectly] Learn Mode response complete (attempt {attempt + 1})")
                break
            else:
                missing = []
                if not has_explanation: missing.append("explanation")
                if not has_analogy: missing.append("analogy")
                if not has_examples: missing.append("examples")
                if not has_quiz: missing.append("quiz")
                if not has_resources: missing.append("resources")
                print(f"[Lectly] Learn Mode response incomplete (attempt {attempt + 1}), missing: {', '.join(missing)}")
                if attempt == 0:
                    print(f"[Lectly] Retrying...")

        if data is None:
            raise ValueError("Failed to generate Learn Mode content")

        # Cache the response for instant retrieval next time
        try:
            save_learn_mode_cache(
                request.lecture_id, section_idx,
                request.level, request.card_style or "mixed",
                json.dumps(data),
            )
            print(f"[Lectly] Learn Mode cached for {request.lecture_id} section {section_idx}")
        except Exception as cache_err:
            print(f"[Lectly] Cache save failed (non-fatal): {cache_err}")

        return _build_learn_mode_response(data, request.level)

    except Exception as e:
        print(f"[Lectly] Learn Mode failed: {e}")
        raise e


# ──────────────────────────────────────────────
# Ask Tutor
# ──────────────────────────────────────────────

async def ask_tutor(
    lecture_id: str,
    question: str,
    conversation_history: list = None,
    current_section_index: int = None,
    card_context: dict = None,
) -> str:
    """
    Answer a student's question using lecture context.
    The tutor knows the full lecture notes and responds conversationally.

    card_context (optional) — describes what the student is currently viewing:
      {
        "card_type": "concept" | "quiz" | "analogy",
        "card_content": str,       # the card body text
        "card_title": str,         # subtitle for concept cards
        "quiz_question": str,      # the quiz question text (if quiz card)
        "quiz_options": [str],     # quiz options (if quiz card)
        "student_answer": str,     # what the student picked (if answered wrong)
        "correct_answer": str,     # correct answer (if quiz revealed)
      }
    """
    lecture = db_get_lecture(lecture_id)

    if not lecture:
        raise ValueError(f"Lecture {lecture_id} not found")

    notes = lecture.get("notes")
    transcript_text = lecture.get("transcript_text", "")

    if not notes and not transcript_text:
        raise ValueError("No lecture content available. Process the lecture first.")

    # Build the lecture context for Gemini
    context_parts = []

    if notes:
        context_parts.append(f"LECTURE TITLE: {notes.get('title', 'Untitled')}")
        context_parts.append(f"SUMMARY: {notes.get('summary', '')}")
        context_parts.append("")

        sections = notes.get("sections", [])
        for i, section in enumerate(sections):
            context_parts.append(f"SECTION {i + 1}: {section.get('heading', '')}")
            context_parts.append(section.get("content", ""))
            key_points = section.get("key_points", [])
            if key_points:
                context_parts.append("Key points: " + "; ".join(key_points))
            definitions = section.get("definitions", [])
            for d in definitions:
                if isinstance(d, dict):
                    context_parts.append(f"Definition — {d.get('term', '')}: {d.get('definition', '')}")
            context_parts.append("")

    # Add position context
    position_note = ""
    if current_section_index is not None and notes:
        sections = notes.get("sections", [])
        if current_section_index < len(sections):
            current_heading = sections[current_section_index].get("heading", "")
            position_note = f"\n\nThe student is currently studying Section {current_section_index + 1}: \"{current_heading}\". Focus your answer around this topic when relevant."

    # Add card context — tells the tutor exactly what the student is looking at
    card_note = ""
    if card_context:
        card_type = card_context.get("card_type", "unknown")
        if card_type == "concept":
            card_title = card_context.get("card_title", "")
            card_content = card_context.get("card_content", "")
            card_note = f'\n\nCURRENT CARD (Concept): "{card_title}"\nCard content: {card_content[:1500]}\nThe student is reading this card right now. If their question relates to it, ground your answer in this specific content.'
        elif card_type == "quiz":
            quiz_q = card_context.get("quiz_question", "")
            quiz_opts = card_context.get("quiz_options", [])
            student_ans = card_context.get("student_answer", "")
            correct_ans = card_context.get("correct_answer", "")
            card_note = f'\n\nCURRENT CARD (Quiz Question): "{quiz_q}"\nOptions: {", ".join(quiz_opts)}'
            if student_ans and correct_ans:
                card_note += f'\nThe student answered: "{student_ans}" (WRONG). The correct answer is: "{correct_ans}".'
                card_note += '\nExplain why their answer is wrong and why the correct answer is right. Use step-by-step reasoning. If it involves a calculation, show ALL working.'
            elif correct_ans:
                card_note += f'\nCorrect answer: "{correct_ans}"'
            card_note += '\nThe student is on this quiz question. Tailor your response to help them understand it.'
        elif card_type == "analogy":
            card_content = card_context.get("card_content", "")
            card_note = f'\n\nCURRENT CARD (Analogy): {card_content[:1000]}\nThe student is reading this analogy card. If they ask for a different analogy, provide a completely fresh one.'

    # Build conversation for Gemini
    # IMPORTANT: Question goes FIRST so the model focuses on it.
    # Lecture content goes AFTER as reference material.
    lecture_context = "\n".join(context_parts)

    user_message_parts = []

    # 1. THE QUESTION — front and center
    user_message_parts.append(f"STUDENT'S QUESTION: {question}")
    user_message_parts.append("")

    # 2. Card context (what they're looking at right now)
    if card_note:
        user_message_parts.append(card_note)

    # 3. Position context
    if position_note:
        user_message_parts.append(position_note)

    # 4. Conversation history
    if conversation_history:
        user_message_parts.append("\n---\nPREVIOUS CONVERSATION:")
        for msg in conversation_history[-10:]:
            role_label = "Student" if msg.get("role") == "user" else "Tutor"
            user_message_parts.append(f"{role_label}: {msg.get('content', '')}")

    # 5. Lecture content LAST — as reference only, not the focus
    user_message_parts.append("\n---\nBACKGROUND REFERENCE (lecture notes — do NOT summarize these, only use to ground your answer):")
    user_message_parts.append(lecture_context)

    user_message = "\n".join(user_message_parts)

    print(f"[Lectly] Ask Tutor for lecture {lecture_id}: \"{question[:80]}...\"")

    # Call Claude Haiku — tutor uses plain text response, not JSON
    # Higher temperature (0.5) for more natural, teaching-style responses
    try:
        response = _call_claude_with_fallback(TUTOR_SYSTEM_PROMPT, user_message, json_mode=False, temperature=0.5)
    except Exception as e:
        print(f"[Lectly] All LLMs failed for tutor: {e}")
        response = "I'm having trouble connecting right now. Please try again in a moment."

    print(f"[Lectly] Tutor response: {len(response)} chars")
    return response
