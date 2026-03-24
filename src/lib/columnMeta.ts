/**
 * Smartsheet column business-logic rules.
 * Determines how each column should render/validate in the UI.
 */

import { SmartsheetColumn } from './smartsheet'

export type FieldRenderType =
  | 'text'
  | 'number'
  | 'percentage'    // 0-100 slider + numeric input
  | 'date'          // calendar picker
  | 'picklist'      // single-select dropdown
  | 'contact'       // multi-contact picker
  | 'checkbox'      // boolean toggle
  | 'duration'      // "Nd" or hours – number + unit
  | 'readonly'      // formula / system – display only

export interface FieldMeta {
  renderType: FieldRenderType
  label: string
  required: boolean
  min?: number
  max?: number
  unit?: string
  hint?: string
  readonlyReason?: string
}

// Title-based heuristics (case-insensitive) to augment column type
const READONLY_TITLE_PATTERNS = [
  /predecessor/i,
  /auto.?number/i,
  /row.?id/i,
  /created.?(by|date)/i,
  /modified.?(by|date)/i,
]

const PERCENTAGE_TITLE_PATTERNS = [/%\s*complete/i, /percent/i, /completion/i]
const DURATION_TITLE_PATTERNS = [/^duration$/i]
const NUMBER_TITLE_PATTERNS = [/budget/i, /cost/i, /hours/i, /days/i, /count/i]

export function getFieldMeta(col: SmartsheetColumn): FieldMeta {
  const title = col.title || ''

  // System / formula columns → always read-only
  if (col.systemColumnType || col.formula) {
    return {
      renderType: 'readonly',
      label: title,
      required: false,
      readonlyReason: col.formula ? 'Calculated by Smartsheet formula' : 'System column',
    }
  }

  // Title-pattern read-only (predecessors etc.)
  if (READONLY_TITLE_PATTERNS.some(p => p.test(title))) {
    return {
      renderType: 'readonly',
      label: title,
      required: false,
      readonlyReason: 'Managed by Smartsheet',
    }
  }

  // Date columns
  if (col.type === 'DATE') {
    return { renderType: 'date', label: title, required: col.primary ?? false }
  }

  // Picklist
  if (col.type === 'PICKLIST') {
    return { renderType: 'picklist', label: title, required: false }
  }

  // Contact
  if (col.type === 'CONTACT_LIST') {
    return { renderType: 'contact', label: title, required: false }
  }

  // Checkbox
  if (col.type === 'CHECKBOX') {
    return { renderType: 'checkbox', label: title, required: false }
  }

  // % Complete — special slider
  if (PERCENTAGE_TITLE_PATTERNS.some(p => p.test(title))) {
    return {
      renderType: 'percentage',
      label: title,
      required: false,
      min: 0,
      max: 100,
      hint: '0 – 100',
    }
  }

  // Duration
  if (DURATION_TITLE_PATTERNS.some(p => p.test(title))) {
    return {
      renderType: 'duration',
      label: title,
      required: false,
      hint: 'e.g. 5d or 8h',
    }
  }

  // Generic number fields
  if (col.type === 'TEXT_NUMBER' && NUMBER_TITLE_PATTERNS.some(p => p.test(title))) {
    return { renderType: 'number', label: title, required: false, min: 0 }
  }

  // Primary text column
  if (col.primary) {
    return { renderType: 'text', label: title, required: true, hint: 'Required' }
  }

  return { renderType: 'text', label: title, required: false }
}

/**
 * Validate a single field value. Returns error string or null.
 */
export function validateField(meta: FieldMeta, value: any): string | null {
  if (meta.required && (value === null || value === undefined || value === '')) {
    return `${meta.label} is required`
  }

  if (meta.renderType === 'percentage') {
    const n = parseFloat(String(value ?? ''))
    if (value !== '' && value !== null && value !== undefined) {
      if (isNaN(n)) return 'Must be a number'
      if (n < 0) return 'Cannot be less than 0'
      if (n > 100) return 'Cannot exceed 100'
    }
  }

  if (meta.renderType === 'number') {
    const n = parseFloat(String(value ?? ''))
    if (value !== '' && value !== null && value !== undefined) {
      if (isNaN(n)) return 'Must be a valid number'
      if (meta.min !== undefined && n < meta.min) return `Minimum is ${meta.min}`
      if (meta.max !== undefined && n > meta.max) return `Maximum is ${meta.max}`
    }
  }

  if (meta.renderType === 'duration') {
    const v = String(value || '')
    if (v && !/^\d+(\.\d+)?\s*[dhw]?$/i.test(v.trim())) {
      return 'Use format like 5d, 8h, or 2w'
    }
  }

  if (meta.renderType === 'date') {
    if (value && typeof value === 'string') {
      const d = new Date(value)
      if (isNaN(d.getTime())) return 'Invalid date'
    }
  }

  return null
}

/**
 * Sanitise a value before sending to Smartsheet API.
 */
export function sanitiseValue(meta: FieldMeta, value: any): any {
  if (value === '' || value === undefined) return null
  if (meta.renderType === 'percentage' || meta.renderType === 'number') {
    const n = parseFloat(String(value))
    return isNaN(n) ? null : n
  }
  if (meta.renderType === 'checkbox') return Boolean(value)
  return value
}
