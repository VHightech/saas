// Feature flags.
//
// PagoPA online payment is not available yet. All the underlying code
// (payment-actions, PaymentModal, handlePay handlers, the "MP23" wiring) is kept
// intact for when it's enabled — but every payment-related UI element is hidden
// behind this flag. Flip to `true` to re-enable the whole PagoPA experience.
export const PAGOPA_ENABLED = false
