export function summarizeCypressResult(result) {
  if (!result || typeof result !== 'object') {
    return { failed: 1, passed: 0, total: 0, messages: ['Cypress nao retornou resultados.'] }
  }

  if (Number(result.failures) > 0) {
    return {
      failed: Number(result.failures),
      passed: 0,
      total: 0,
      messages: [result.message || 'Cypress nao conseguiu iniciar os testes.'],
    }
  }

  const runs = Array.isArray(result.runs) ? result.runs : []
  const runErrors = runs
    .filter((run) => run?.error)
    .map((run) => String(run.error))
  const runFailures = runs.reduce((sum, run) => sum + Number(run?.stats?.failures || 0), 0)
  const failed = Math.max(Number(result.totalFailed || 0), runFailures, runErrors.length)

  return {
    failed,
    passed: Number(result.totalPassed || 0),
    total: Number(result.totalTests || 0),
    messages: runErrors,
  }
}
