/**
 * Cached address-book entries.
 *
 * Note that the API's `company` is the company **name**, a string, not a
 * reference into the companies store — so `byCompany` groups by what the CRM
 * itself displays. See `schema.js`.
 */

import { STORE } from '@/offline/db/schema.js'
import { createRecordRepository } from '@/offline/repositories/recordRepository.js'

const base = createRecordRepository(STORE.CONTACTS)

export const contactsRepository = {
  ...base,

  /** Contacts filed under one company name. */
  byCompany(companyName, options = {}) {
    return base.byIndex('company', companyName, options)
  },
}

export default contactsRepository
