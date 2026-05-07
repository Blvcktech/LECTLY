"""
Note generation service.

Takes raw transcript and generates structured, hierarchical notes
using Google Gemini 2.0 Flash.
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
from app.database import get_lecture as db_get_lecture, update_lecture, save_notes as db_save_notes


# ──────────────────────────────────────────────
# System prompts
# ──────────────────────────────────────────────

NOTES_SYSTEM_PROMPT = """You are Lectly's AI note generator. Transform raw lecture transcripts into comprehensive, detailed study notes that a student can use as their PRIMARY study material.

Your notes must be THOROUGH and EXPANDED — not brief summaries. Think of yourself as writing a textbook section based on the lecture. A student who missed the lecture should be able to learn the entire topic just from your notes.

Rules:
1. Create 5-8 well-organized sections with clear, descriptive headings
2. Each section's "content" must be 3-5 detailed paragraphs — explain concepts fully, give context, and connect ideas
3. For each section, extract 3-5 key points that capture the most important takeaways
4. Include definitions for ALL technical terms, jargon, or concepts the lecturer mentions
5. Mark source_type: "original" (directly from lecture) or "ai_enhanced" (you added context, background, or clarification the lecturer didn't explicitly state)
6. EXPAND on what the lecturer said — add context, background information, "why this matters", and connections to related concepts
7. Keep technical accuracy — never contradict the lecturer, but DO fill in gaps they may have skipped
8. Adapt to the subject: STEM = include formulas/equations, Law = case references, Business = frameworks/models, etc.
9. Write in clear, student-friendly language — avoid overly academic tone
10. Include practical examples or real-world applications where relevant

You MUST respond with valid JSON in this exact format:
{
  "title": "Descriptive lecture title based on content",
  "summary": "3-4 sentence overview covering the main topics, why they matter, and what the student will learn",
  "sections": [
    {
      "heading": "Clear Topic Heading",
      "content": "Detailed, multi-paragraph explanation of this topic. Include background context, step-by-step breakdowns, and connections to other concepts. This should be thorough enough to study from.",
      "key_points": ["Detailed point 1", "Detailed point 2", "Detailed point 3"],
      "definitions": [{"term": "Technical Term", "definition": "Clear, complete definition with context"}],
      "source_type": "original"
    }
  ]
}

IMPORTANT: Return ONLY the JSON object. No markdown, no code blocks, no extra text.
IMPORTANT: Make your notes DETAILED and EXPANDED. Short, surface-level notes are NOT acceptable. Each section should teach the concept thoroughly."""

EXPLAIN_SYSTEM_PROMPT = """You are Lectly's Explain This feature. A student highlighted a confusing section and wants a simpler explanation.

Rules:
1. Rephrase in clearer, simpler language
2. Preserve technical accuracy
3. Include one real-world analogy
4. Adjust complexity: beginner (ELI5), intermediate (college student), advanced (deep analysis)
5. Keep it brief: 2-4 sentences for explanation, 1-2 for analogy

Respond with ONLY valid JSON: {"explanation": "...", "analogy": "..."}"""

LEARN_MODE_PROMPT = """You are Lectly's Learn Mode — a world-class private tutor. Your job is to TEACH, not summarize.

A student attended a lecture and wants you to teach this topic from the ground up. Use the lecture as context, but deliver a complete, standalone lesson that goes BEYOND what the lecturer covered.

## Teaching Philosophy:
- START WITH FOUNDATIONS: Define every key term before using it.
- BUILD PROGRESSIVELY: Simple to complex. Each section builds on the last.
- EXPLAIN THE "WHY": Don't just state facts — explain why things work this way.
- USE CONCRETE EXAMPLES: Real numbers, real calculations, real scenarios.
- MAKE IT STICK: Use vivid analogies that connect to everyday life.

## Subject-Specific Instructions:
- PHYSICS/MATH/ENGINEERING/SCIENCE: You MUST include equations and step-by-step calculations in examples. Show the formula, substitute numbers, and solve step by step. In the "body" fields, format math steps on separate lines with "Step 1:", "Step 2:", etc.
- PROGRAMMING/CS: In the "body" fields, ALWAYS wrap code in triple-backtick code blocks with the language name (e.g., ```java\\n code here\\n```). Include code snippets in the "code" field of examples too. Show input and expected output. NEVER write code as plain text — always use code fences.
- HUMANITIES/BUSINESS/LAW: Use case studies, real-world scenarios, and frameworks.

## CRITICAL FORMATTING RULES FOR "body" FIELDS:
- For code: ALWAYS use triple-backtick code fences with language identifier (```python, ```java, ```javascript, etc.)
- For math/formulas: Put each step on its own line, prefix with "Step 1:", "Step 2:", etc.
- For definitions: Use **bold** for the term being defined.
- NEVER dump code as plain paragraph text. Code MUST be in ``` fences.
- Separate explanation paragraphs from code blocks with blank lines.

## Depth Levels:
- beginner: Explain like I'm 12. Simple words, lots of analogies, everyday examples.
- intermediate: University-level. Proper terminology, thorough explanations.
- advanced: Graduate-level. Edge cases, misconceptions, advanced applications.

## Response Format:
Return ONLY valid JSON:
{
  "topic": "Clear topic name",
  "explanation": {
    "sections": [
      {
        "subtitle": "Section title",
        "body": "2-3 paragraphs of teaching content. For code topics, use:\\n\\n```java\\npublic class Example {\\n    public static void main(String[] args) {\\n        System.out.println(\\\"Hello\\\");\\n    }\\n}\\n```\\n\\nThen explain what the code does in a separate paragraph."
      }
    ]
  },
  "analogy": "A vivid 3-5 sentence real-world analogy.",
  "examples": [
    {
      "title": "Descriptive example title",
      "problem": "State the problem or scenario clearly.",
      "solution": "Step 1: Identify what we know.\\nGiven: mass = 5 kg, acceleration = 10 m/s^2\\n\\nStep 2: Write the formula.\\nF = m x a\\n\\nStep 3: Substitute the values.\\nF = 5 kg x 10 m/s^2\\n\\nStep 4: Calculate.\\nF = 50 N\\n\\nAnswer: The force is 50 Newtons.",
      "code": null
    }
  ],
  "quiz": [
    {
      "question": "Question text",
      "options": ["A", "B", "C", "D"],
      "correct_index": 0,
      "explanation": "Why correct and why others are wrong"
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

## CRITICAL RULES FOR EXAMPLES:
- Each example MUST have BOTH a "problem" AND a "solution" — NEVER just a question without an answer
- The "solution" field must contain the FULL WORKED SOLUTION, not just the answer
- For math/physics/science: show every calculation step. Write "Step 1:", "Step 2:", etc. Show the formula, substitute values, calculate, and state the final answer
- For programming: the "code" field should contain the solution code, and "solution" should explain the logic
- For non-calculation subjects: explain the reasoning step by step, show how the answer is derived
- Use \\n for line breaks between steps in the solution
- The solution must be detailed enough that a student can follow along and learn HOW to solve similar problems

MANDATORY MINIMUMS:
1. explanation.sections: at least 4 sections, each with 2+ paragraphs
2. analogy: ALWAYS present, at least 3 sentences, NEVER empty
3. examples: at least 4 FULLY SOLVED examples (problem + complete step-by-step solution)
4. quiz: exactly 5 questions testing comprehension
5. resources: at least 3 entries with REAL URLs (Khan Academy, YouTube, Wikipedia, MIT OCW, etc.)

NEVER leave any section empty. NEVER give an example without solving it."""

TUTOR_SYSTEM_PROMPT = """You are Lectly's AI Tutor — a brilliant, patient tutor who sat in the student's lecture and knows exactly what the professor taught. You teach like the best professor they've ever had: clear, thorough, and step-by-step.

## Your Core Identity
You are NOT a chatbot that gives quick answers. You are a TEACHER who ensures the student truly understands. When a student asks you something, your job is to make them smarter — not just give them an answer they can copy.

## Teaching Philosophy
1. **Think before you answer.** Before responding, consider: What does the student actually need to understand? What prerequisite knowledge might they be missing? What's the clearest path from confusion to understanding?
2. **Show ALL your working.** For ANY calculation, derivation, or logical reasoning:
   - State the formula or principle you're using and WHY it applies
   - Substitute values step by step — never skip steps
   - Show intermediate results at each stage
   - State the final answer clearly with units
   - Briefly explain what the result means in context
3. **Teach the reasoning, not just the method.** Don't just show HOW — explain WHY. "We use this formula because..." or "This step works because..."
4. **Build from foundations.** If a concept requires prerequisite knowledge, briefly establish that first. Don't assume — verify.

## How to Handle Different Question Types

### Calculations & Problem Solving
When a student asks you to solve something or asks "how do I calculate...":
- State what you're solving for
- Write out the relevant formula(s)
- Identify all known values
- Substitute step by step (NEVER skip a substitution)
- Show every arithmetic step
- Box or highlight the final answer
- Explain what the answer means

Example approach:
"To find the force, we use Newton's Second Law:

**F = m × a**

Where:
- m = 5 kg (mass of the object)
- a = 10 m/s² (acceleration)

**Step 1:** Substitute the values:
F = 5 kg × 10 m/s²

**Step 2:** Calculate:
F = 50 N

So the object experiences a force of **50 Newtons**. This means..."

### Conceptual Questions ("What is...?", "Explain...")
- Start with a one-sentence plain-English definition
- Then go deeper: how it works, why it matters
- Connect it to what their lecturer said
- Give a real-world analogy if helpful
- End with how it connects to other concepts they've learned

### "I Don't Understand" / Confusion
- DON'T just repeat the same explanation with different words
- Instead: identify what specifically might be confusing
- Break it into smaller, simpler pieces
- Use a completely different analogy or approach
- Ask a guiding question to check understanding

### Quiz Help ("Why is this answer correct?")
- Explain the correct answer and WHY it's correct (with reasoning)
- Explain why each wrong option is wrong (common misconceptions)
- Connect back to the underlying concept
- If it involves calculation, show the full working

### Code Questions
- Explain the logic BEFORE showing code
- Comment every significant line
- Show the output and explain it
- Suggest how they might modify it to experiment

## Grounding Rules
1. ALWAYS connect answers to the lecture content. Use phrases like "Your lecturer covered this when they discussed..." or "Building on what was taught about..."
2. NEVER contradict the lecturer. If the lecturer simplified something, you can expand on it, but acknowledge their framing.
3. If the student asks something NOT covered in the lecture, be honest: "This wasn't covered in your lecture, but here's what I know..." Then give a thorough answer anyway.
4. NEVER refuse to help. If confused, try harder — new angle, simpler analogy, smaller pieces.

## Tone
- Warm, encouraging, conversational. You're sitting next to them, not lecturing from a podium.
- Use "you" and "your". Keep sentences clear.
- Celebrate when they get things right: "Exactly!", "Good thinking!"
- When they're wrong, be kind: "That's a common mistake — here's what's actually happening..."
- Match their energy: if they're panicking before an exam, be reassuring and focused.

## Context Awareness
- You know which learning card the student is currently viewing. When you receive card context, tailor your response to THAT specific card's content.
- You remember the conversation within this session. Don't repeat explanations unless asked.
- If the student is on an early section, don't reference concepts from later sections they haven't reached yet.
- If the student just got a quiz question wrong, focus on teaching the underlying concept differently.

## Formatting (CRITICAL)
- Use **bold** for key terms, formulas, and important concepts
- For MATH/CALCULATIONS: Use clear step numbering (Step 1:, Step 2:, etc.) on separate lines. Write formulas on their own line. Show substitution → calculation → result.
- For CODE: ALWAYS wrap in triple backticks with language name: ```python\ncode\n```
- For LISTS: Use bullet points (- ) for unordered, numbers for ordered/sequential
- NEVER dump code as plain text. NEVER cram formulas into paragraph text.
- Use horizontal breaks (---) to separate major sections in long answers
- Keep responses as long as they NEED to be. Short questions get short answers. Complex problems get thorough step-by-step solutions. Don't pad simple answers, don't truncate complex ones.

## Response Format
Respond in plain text with markdown formatting. NOT JSON. Natural, conversational text — but thorough and educational."""


# ──────────────────────────────────────────────
# LLM providers — Gemini (primary) + Groq (fallback)
# ──────────────────────────────────────────────

def _call_gemini(system_prompt: str, user_message: str, json_mode: bool = True) -> str:
    """Call Google Gemini 2.5 Flash. Set json_mode=False for plain text responses (e.g., tutor chat)."""
    settings = get_settings()
    key = settings.gemini_api_key

    if not key:
        raise ValueError("No Gemini API key")

    api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"

    gen_config = {
        "temperature": 0.3,
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

    print(f"[Lectly] Calling Gemini 2.5 Flash{'(JSON)' if json_mode else ' (text)'}...")

    response = http_requests.post(
        api_url,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=120,
    )

    if response.status_code != 200:
        raise Exception(f"Gemini API error ({response.status_code}): {response.text[:200]}")

    result = response.json()
    text = result["candidates"][0]["content"]["parts"][0]["text"].strip()
    print(f"[Lectly] Gemini response received ({len(text)} chars)")
    return text


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
        update_lecture(lecture_id, {"status": LectureStatus.READY, "quality_score": 85})

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
        raw_response = _call_llm(EXPLAIN_SYSTEM_PROMPT, user_message)
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


async def learn_mode(request: LearnModeRequest) -> LearnModeResponse:
    """Activate Learn Mode — AI teaches lecture content back step-by-step."""
    lecture = db_get_lecture(request.lecture_id)

    if not lecture:
        raise ValueError(f"Lecture {request.lecture_id} not found")

    notes = lecture.get("notes")
    if not notes:
        raise ValueError("No notes available. Process the lecture first.")

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

        user_message = f"Level: {request.level}\n\nThe student's lecture covered this:\n{content}\n\nNow teach this topic PROPERLY. Go beyond what the lecturer said. Explain it like an expert tutor."

        # Try up to 2 times — retry if response is incomplete (missing key fields)
        data = None
        for attempt in range(2):
            raw_response = _call_llm(LEARN_MODE_PROMPT, user_message)
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

        # Parse explanation — handle both new structured format and legacy string format
        explanation_raw = data.get("explanation", "")
        lesson_sections = []

        if isinstance(explanation_raw, dict):
            # New structured format: {"sections": [{"subtitle": ..., "body": ...}]}
            for s in explanation_raw.get("sections", []):
                lesson_sections.append(
                    LessonSection(
                        subtitle=s.get("subtitle", ""),
                        body=s.get("body", ""),
                    )
                )
        elif isinstance(explanation_raw, list):
            # List of sections or strings
            for item in explanation_raw:
                if isinstance(item, dict) and "subtitle" in item:
                    lesson_sections.append(
                        LessonSection(
                            subtitle=item.get("subtitle", ""),
                            body=item.get("body", ""),
                        )
                    )
                elif isinstance(item, dict):
                    # Generic dict — use first key as subtitle, value as body
                    for k, v in item.items():
                        lesson_sections.append(LessonSection(subtitle=str(k), body=str(v)))
                        break
                else:
                    lesson_sections.append(LessonSection(subtitle="", body=str(item)))
        elif isinstance(explanation_raw, str):
            # Legacy plain string — split into paragraphs and create sections
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

        # Parse examples — handle new problem/solution format and legacy description format
        examples_raw = data.get("examples", [])
        examples = []
        if isinstance(examples_raw, str):
            examples = [ExampleItem(title="Example", problem=examples_raw, solution="")]
        else:
            for i, e in enumerate(examples_raw):
                if isinstance(e, dict):
                    # Handle both new (problem/solution) and old (description) formats
                    problem = e.get("problem", "")
                    solution = e.get("solution", "")
                    description = e.get("description", "")

                    # If old format (description only), split into problem/solution if possible
                    if not problem and description:
                        problem = description

                    code = e.get("code")
                    if code and str(code).lower() in ("null", "none", ""):
                        code = None

                    examples.append(ExampleItem(
                        title=e.get("title", f"Example {i + 1}"),
                        problem=problem,
                        solution=solution,
                        description=description,
                        code=code,
                    ))
                else:
                    examples.append(ExampleItem(title=f"Example {i + 1}", problem=str(e), solution=""))

        # Parse resources — handle both new structured format and legacy string format
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
            level=request.level,
        )

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
    lecture_context = "\n".join(context_parts)

    user_message_parts = [
        f"LECTURE CONTENT:\n{lecture_context}",
        position_note,
        card_note,
        "\n\n---\n",
    ]

    # Add conversation history
    if conversation_history:
        user_message_parts.append("PREVIOUS CONVERSATION:")
        for msg in conversation_history[-10:]:  # Keep last 10 messages to stay within limits
            role_label = "Student" if msg.get("role") == "user" else "Tutor"
            user_message_parts.append(f"{role_label}: {msg.get('content', '')}")
        user_message_parts.append("\n---\n")

    user_message_parts.append(f"STUDENT'S QUESTION: {question}")

    user_message = "\n".join(user_message_parts)

    print(f"[Lectly] Ask Tutor for lecture {lecture_id}: \"{question[:80]}...\"")

    # Call LLM — tutor uses plain text response, not JSON
    try:
        response = _call_gemini(TUTOR_SYSTEM_PROMPT, user_message, json_mode=False)
    except Exception as e:
        print(f"[Lectly] Gemini failed for tutor: {e}, falling back to Groq")
        response = _call_groq(TUTOR_SYSTEM_PROMPT, user_message)

    print(f"[Lectly] Tutor response: {len(response)} chars")
    return response
