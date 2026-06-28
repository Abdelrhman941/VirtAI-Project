You are a Senior Staff Software Engineer and Software Architect working on the VirtAI project.  
Your goal is **not just implementing features**, but auditing the entire flow, fixing architecture problems, removing dead code, and delivering a clean production-ready implementation.  
Before changing anything:  
Understand the complete architecture.  
Trace every request end-to-end.  
Find the actual source of every problem.  
Never patch symptoms.  
Fix root causes only.  
The project structure is already provided.  
Global Rules  

---------------------

1. No duplicated prompts  
Currently prompts are scattered.  
I already created the prompt registry here:  
backend/app/application/prompts/rag/
It contains Arabic and English prompts.  
Your job is:  
move ALL prompt texts there  
remove prompt duplication  
every feature must load its prompt from the registry  
there must be ONE source of truth  
No feature may contain embedded prompts.  
That includes:  
Explain  
Summary  
Quiz  
Visualization  
Diagram  
Walkthrough  
If a node currently contains a prompt:  
Remove it.  
Replace it with:  
Prompt Registry → Use Case → Node  
Never the opposite.

---------------------

1. Explain Walkthrough Refactor  
Currently Explain works slide-by-slide.  
This causes fragmented explanations.  
I want Explain to behave like a continuous lecture.  
Instead of treating slides independently:  
The AI must understand:  
previous slides  
current slide  
next slide  
It should create one continuous lecture.  
Requirements:  
merge irrelevant chunks  
remove duplicated context  
preserve slide order  
maintain transitions  
explain relationships between slides  
avoid repeating concepts already explained  
preserve slide numbering  
The lecture should feel like a professor teaching one lecture rather than independent slides.  
Audit:  
WalkthroughUseCaseExplainUseCaseExplain HandlerExplain WSRetrieval pipelineChunk selection
Find architectural issues.  
Improve them.  

---------------------

1. Summary Button  
Currently frontend has  
Explain  
Diagram  
Quiz  
Add  
Summary  
beside them.  
Requirements:  
Frontend:  
new Summary button  
loading state  
disabled state  
error state  
reuse existing UI style  
Backend:  
connect it to SummaryUseCase  
Do NOT duplicate code.  
Reuse existing architecture.  
Summary must use Prompt Registry.  

---------------------

1. Visualization (Napkin) Audit  
Currently:  
Visualize returns  
Error:An unknown error occurred while visualizing.
I already configured the Napkin API.  
Your job is NOT guessing.  
Your job is tracing the entire pipeline.  
Audit:  
Frontend  
↓  
API  
↓  
Backend endpoint  
↓  
Use Case  
↓  
Napkin Client  
↓  
HTTP Response  
↓  
Parser  
↓  
Frontend rendering  
Find the exact failing layer.  
Check:  
request body  
response body  
API headers  
auth  
timeout  
serialization  
parsing  
error mapping  
frontend handling  
Never swallow exceptions.  
Return meaningful errors.  
If Napkin API changed:  
adapt the implementation.  
If response format changed:  
fix parser.  
If frontend expects wrong shape:  
fix frontend.  

---------------------

1. Mermaid Diagram Fix  
Currently Diagram almost always returns Failed.  
I want a full audit.  
Trace:  
Diagram button  
↓  
Frontend API  
↓  
Backend endpoint  
↓  
Diagram use case  
↓  
Prompt  
↓  
LLM response  
↓  
Mermaid extraction  
↓  
Validation  
↓  
Frontend Mermaid renderer  
Check:  
markdown fences  
mermaid parser  
malformed syntax  
escaped characters  
markdown cleaning  
renderer compatibility  
invalid nodes  
duplicated ids  
unsupported syntax  
If Mermaid extraction is fragile:  
rewrite it.  
If prompt generates inconsistent Mermaid:  
improve prompt.  
Diagram generation must become reliable.  

---------------------

1. Prompt Routing Audit  
Audit every feature that uses prompts.  
Examples:  
Summary  
Explain  
Quiz  
Diagram  
Visualization  
Any RAG node  
Every route must use the correct prompt name.  
Verify:  
Prompt Registry  
↓  
Use Case  
↓  
Node  
↓  
Execution  
No mismatched names.  
No missing registry keys.  
No hardcoded prompt ids.  
No prompt duplication.  

---------------------

1. Node Responsibility Cleanup  
Audit nodes:  
Summary  
Quiz  
Explain  
Visualization  
Diagram  
Nodes should NOT know prompt content.  
Nodes should only:  
receive task  
load prompt  
execute  
Business logic belongs inside Use Cases.  
Prompt text belongs inside Prompt Registry.  

---------------------

1. Backend Cleanup  
Perform a complete backend audit.  
Remove:  
dead code  
unreachable code  
unused imports  
obsolete services  
duplicated helpers  
legacy implementations  
unused endpoints  
unused DTOs  
duplicated utilities  
abandoned feature flags  
Do NOT remove anything still referenced.  
Search entire repository before deleting.  

---------------------

1. Frontend Cleanup  
Audit frontend.  
Remove:  
unused hooks  
unused APIs  
unused components  
dead state  
duplicated logic  
unused utilities  
obsolete handlers  
unused context values  
unused reducers  
unused props  
Clean imports.  
Simplify state.  
Keep behavior unchanged.  

---------------------

1. Preserve Architecture  
Do NOT introduce hacks.  
Do NOT bypass layers.  
Respect existing architecture:  
Presentation  
↓  
Application  
↓  
Domain  
↓  
Infrastructure  
Keep dependency direction clean.  

---------------------

1. Logging  
Improve logging where needed.  
Never hide exceptions.  
Every failure should indicate:  
feature  
request  
root cause  
external API failure  
parsing failure  
rendering failure  
Avoid generic:  
Unknown Error

---------------------

1. Final Verification  
Before finishing:  
Verify:  
✅ Explain works as one continuous lecture  
✅ Summary button exists  
✅ Summary uses Prompt Registry  
✅ Explain uses Prompt Registry  
✅ Quiz uses Prompt Registry  
✅ Diagram uses Prompt Registry  
✅ Visualization uses Prompt Registry  
✅ Napkin visualization works  
✅ Mermaid diagrams render correctly  
✅ No duplicated prompts  
✅ No hardcoded prompts  
✅ No dead backend code  
✅ No dead frontend code  
✅ No broken imports  
✅ No unused services  
✅ No architectural violations  
Deliverables  
At the end provide a detailed report containing:

--------------------

1. Architecture Changes  
Explain every architectural improvement.  

--------------------

1. Files Modified  
List every modified file with the reason.  

--------------------

1. Dead Code Removed  
List everything removed.  

---------------------

1. Bugs Fixed  
Explain:  
root cause  
fix  
why it happened  

---------------------

1. Prompt Registry Audit  
List every feature and which registry prompt it now uses.  

---------------------

1. Diagram Audit  
Explain why diagrams previously failed.  
Explain the implemented fix.  

---------------------

1. Napkin Audit  
Explain why visualization previously failed.  
Explain the implemented fix.  

---------------------

1. Explain Refactor  
Explain how the lecture became continuous instead of slide-isolated.  

---------------------

1. Remaining Issues  
List anything that still requires manual work or external dependencies (if any).  
**Important Constraints**  
Do **not** stop after the first issue; complete all requested tasks in a single implementation pass.  
Prefer **root-cause fixes** over workarounds.  
Do **not** duplicate logic or prompts.  
Maintain backward compatibility where possible.  
Ensure the project builds successfully and all existing tests continue to pass (updating tests only when behavior intentionally changes).  
If an external API (such as Napkin) has changed, update the integration rather than adding temporary compatibility hacks.  
Keep the codebase cleaner than you found it, with reduced technical debt and a single source of truth for prompts.
