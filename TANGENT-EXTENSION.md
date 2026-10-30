# Exact polynomial tangent extension

Adds tangent verification for rational-coefficient polynomials through degree four at rational evaluation points. Uses bounded rational arithmetic, symbolic polynomial differentiation and exact evaluation; no CAS, model, floating-point tolerance or new dependency.

Example adapted from the user's FOS Mathematics 2024 task 2.2:

- f(x) = -4/5*x^4 + 29/5*x^2 - 5
- x0 = 3/2
- f(x0) = 4; f'(x0) = 33/5
- correct tangent: y = 33/5*x - 59/10

Select the exam tangent task, enter the tangent in the solution field, and leave the optional steps field empty. Equivalent affine forms such as y = 4 + 33/5*(x - 3/2) are accepted. Optional steps must themselves be tangent equations; derivative calculation steps and prose are not verified. Unsupported syntax stops before the provider with UNKNOWN.

Only the tangent equation is mathematically checked. This does not verify the entire examination, a student's reasoning, free-text feedback or educational ability. The Cloudflare workflow remains explicitly simulated. The existing real Nebius example and its historical decision are unchanged.

The existing quadratic report format and checker identifier remain unchanged for replay compatibility. New tangent records use exact-polynomial-tangent-v1; task, answer and report are included in the existing binding and persistent review process. Correct approved attempts select a cubic tangent follow-up; incorrect approved attempts repeat the same task.

Validation: 129 offline tests, including exact exam values, equivalent forms, wrong slope/intercept, close-but-inexact decimals, bounded/unsupported syntax, generated cubic cases, workflow contradiction rejection, SQLite HTTP persistence and synthetic human approval. No real provider requests. Native browser inspection and production deployment of this extension remain outstanding.
