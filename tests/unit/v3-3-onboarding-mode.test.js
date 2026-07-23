import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildFirstStepsChecklist } from '@/domain/v3/proactiveOrchestrator.js'

const read = (file) => fs.readFileSync(file, 'utf8')

describe('V3.3 operational first steps', () => {
  it('renders a compact first-steps strip in the command center', () => {
    const component = read('src/components/v3/FirstStepsStrip.vue')
    const commandCenter = read('src/views/CommandCenter.vue')

    expect(component).toContain('data-testid="v33-first-steps"')
    expect(component).toContain('Primeiros passos')
    expect(component).toContain('step.status')
    expect(commandCenter).toContain("import FirstStepsStrip from '@/components/v3/FirstStepsStrip.vue'")
    expect(commandCenter).toContain('<FirstStepsStrip')
    expect(commandCenter).toContain(':steps="proactiveAgenda.firstSteps"')
  })

  it('locks later steps until the user creates the minimum financial base', () => {
    const steps = buildFirstStepsChecklist({
      incomes: [],
      expenses: [],
      planningGoals: [],
    })

    expect(steps.map((step) => step.status)).toEqual(['current', 'locked', 'locked', 'locked'])
  })
})
