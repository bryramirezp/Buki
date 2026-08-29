# Official Rules — OpenAI WebMCP Challenge

Operational summary of the *Official Rules*. **Source of truth: the official Devpost page**
(`webmcp.devpost.com`) and the complete rules. If anything here conflicts with the original, the original wins.

- **Sponsor:** OpenAI OpCo, LLC · **Administrator:** Devpost, Inc.
- **Questions:** support@devpost.com

---

## 1. Dates (all in Pacific Time)

| Milestone | When |
|---|---|
| Registration and submissions open | **August 25, 2026, 11:00 am** |
| **Submission deadline** | **September 3, 2026, 1:00 pm** ← the only date that matters |
| Judging | September 4, 10:00 am → September 21, 5:00 pm |
| Winners | Approximately September 23, 2:00 pm |

> ⚠️ The openai.com landing page says 12:00 pm for opening, while the rules say 11:00 am.
> This is irrelevant for us: **the closing deadline matches in both places (September 3, 1:00 pm PT).**

> ⚠️ The app must remain **live, free, and unrestricted** until judging ends (September 21).
> Submission is not the end of the work.

---

## 2. Eligibility

**Chile is allowed.** ✅

Excluded countries/territories: **Belarus, Brazil, China, Hong Kong, Crimea, Cuba, Iran,
North Korea, Russia, Syria, Venezuela, Donetsk, Luhansk, and the province of Quebec**, plus
any location outside the list of countries supported by the OpenAI API
(`platform.openai.com/docs/supported-countries`).

Also excluded: OpenAI and Devpost employees and agents, judges and their employers, and their relatives or household members.

Individuals, teams, and organizations may enter. For a team, **one representative** submits on behalf of everyone.

---

## 3. Required submission items

All five items are mandatory:

### 3.1 Working public URL

Judges must be able to test it in **the ChatGPT Desktop integrated browser** or in **Chrome with WebMCP enabled**. It may be hosted anywhere (ChatGPT Sites, Cloudflare, Vercel, Render, Netlify, and others). If the app requires login, provide credentials in the form.

### 3.2 Text description — four fixed questions

This is essentially the rubric written as a form:

1. **Why is your use case a good fit for WebMCP?**
2. **How does it create a better user experience?**
3. **What can people and their agents do together that was difficult or impossible before?** ← *the challenge thesis*
4. **Briefly, how did you implement WebMCP?**

### 3.3 Public repository

On GitHub, GitLab, or Bitbucket. It must contain:

- All source code, assets, and instructions required to run the project.
- **An open-source license that is detectable and visible in the repository's “About” section.**
- The `document.modelContext.registerTool({ name, description, inputSchema, execute })` pattern.

### 3.4 Demo video

- **Under 3 minutes.** Judges are not required to watch beyond that.
- **With audio**, covering what you built and how you used WebMCP.
- A clear demonstration of the working project.
- **Public on YouTube**, with the link in the form.
- **No third-party trademarks or copyrighted music.**

### 3.5 Everything in English

Or provide an English translation for the video, description, testing instructions, and everything else.

---

## 4. Judging — the most important section

### Stage 1 — pass / fail

Does the project **reasonably fit the theme** and **reasonably use the required APIs/SDKs**? Binary decision.

### Stage 2 — four equally weighted criteria

Original text, because the nuances matter:

> **WebMCP Leverage** — *How thoroughly and skillfully does the project use WebMCP? Does the
> code reflect genuine effort and a working, non-trivial implementation?*

> **Execution** — *Does the project deliver a working or runnable project that has a complete,
> coherent product experience — not just a technical proof of concept?*

> **Potential Impact** — *Does the project make a credible, specific case for solving a real
> problem for a real audience — and does the solution actually address that problem based on
> what's demonstrated?*

> **Creativity & Ambition** — *How creative and novel is the concept and does the project
> differ from existing concepts?*

**Tie-breaker:** if there is a tie, the project with the higher score in the first criterion in the list (WebMCP Leverage) wins. If still tied, compare the next criterion, and so on. If all criteria are tied, the judges vote.

### Three things people underestimate

1. **Judges are NOT required to test your app.** The rules explicitly say they may judge
   *“solely on the text description, images, and video provided in the Submission.”*
   → **The video and description matter as much as the code.**

2. **An AI may judge you.** The rules allow *“expert panels, peer review, automated AI-driven
   analysis, or any combination.”* → The README and description must be readable by a model, not just a person.

3. **Judges may change** before or during judging and may not be publicly listed.

### Announced judges

Sarah Drasner (Chrome, Google) · Andrew Galloni (Cloudflare) · Jude Gao (Vercel, Next.js core)
· Ilya Grigorik (Shopify) · **Alex Nahas (creator of MCP-B)** · Sean Roberts (Netlify) ·
**Justin Rushing (Browser Agent Lead, OpenAI)**

> Pay attention to the two names in bold: Nahas wrote the WebMCP predecessor and Rushing leads
> browser agents at OpenAI. **They will notice if the tools are superficial.**

---

## 5. Project requirements

**What to build:** a WebMCP-powered web app that imagines and explores the future of the open web — where people and agents can interact, collaborate, and create together.

**New or existing:** extending a previous project is allowed, but:

- The WebMCP extension must have happened **after the Submission Period began**.
- Document **what is prior work and what is new**, with dated evidence (commit history with timestamps or equivalent).
- **Only work added during the Submission Period is evaluated.**

> For Buki, the history must clearly document what is reused from the previous prototype and what is built as a new product during the Submission Period.

**Multiple submissions:** allowed, but each must be substantially different.

**Intellectual property:** the work must be original and yours, without violating third-party rights. Third-party open source may be used in accordance with its licenses, as long as your contribution **builds on top of** that functionality.

**Third-party integrations:** if you use third-party SDKs, APIs, or data, you must be authorized under their terms.

**Each project is eligible for only one prize.**

---

## 6. How to enable WebMCP

- **ChatGPT Desktop** → integrated browser. WebMCP is supported by default.
  Requires *Settings › Browser › Permissions › Enable site tools*.
  **Sol** or **Terra** models (Luna has it disabled). Not available in Enterprise or Edu.
- **Chrome 149+** → `chrome://flags/#enable-webmcp-testing` → Enabled → Relaunch.
  (Local: Chrome 151 ✅ verified working.)

**Important restrictions:**

- Requires a **secure context** (HTTPS or localhost).
- ChatGPT **does not discover tools inside iframes**, and only supports the imperative API on the top-level page.
- If the document is not origin-isolated, WebMCP silently turns off.

---

## 7. Prizes — top 10 submissions

| From | Prize |
|---|---|
| **OpenAI** | $3,000 USD cash · spotlight on @OpenAIDevs · Codex Micro · swag (up to 3 members) · 1 year of ChatGPT Pro (up to 3 members) |
| **Cloudflare** | $10,000 in credits |
| **Vercel** | $300/month in credits + $50/month of Gateway, for 12 months (approximately $4,200) |
| **Render** | $300 in credits |
| **Netlify** | $500 cash |
| **Shopify** | $250 in Shopify Supply gear |
| **Google Chrome** | 3 months of Google AI Ultra per team member |

**To collect a prize:** identity verification and winner forms (W-8BEN for non-US residents) are required within **10 business days**. The winner is responsible for taxes and bank fees. Delivery occurs within 60 days after the forms are received.

**Additional offer:** $3,000 in Netlify credits, available to registered participants until **September 1, 12:00 pm PT** through `forms.gle/xw75XGUQzCXEiALc7`. Not redeemable for cash; must be used before October 3, 2026.

---

## 8. Fine print worth knowing

- **Devpost plugin for ChatGPT Codex:** optional, not required to enter or win. It is an AI helper that **can be wrong** — the official rules and hackathon site always take precedence over anything the plugin says.
- **After the deadline, the submission cannot be modified** unless the sponsor allows it to remove problematic material. Drafts may be saved before the deadline.
- **License:** by entering, you grant OpenAI and Devpost a non-exclusive license to judge, promote, and display your project, and to use your name and likeness in promotional material during the event and for the following three years. **You retain ownership of the code.**
- **Disputes:** individual arbitration under AAA rules and New York law, without class actions.
- The sponsor may disqualify an entry at its discretion for manipulation, conflicts of interest, or conduct it considers inappropriate.

---

## 9. Rules checklist

- [ ] Submitted on Devpost **before September 3, 1:00 pm PT** (not at 12:50)
- [ ] Public HTTPS URL, live and free **until September 21**
- [ ] Test credentials in the form, if needed
- [ ] Public repository with an **open-source license visible in the About section**
- [ ] `document.modelContext.registerTool(...)` present in the code
- [ ] Video under 3 minutes, public on YouTube, with audio, without copyrighted material
- [ ] All four description questions answered — the third one decides
- [ ] Everything in English
- [ ] Original work, with no third-party or employer data
