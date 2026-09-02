/** Cached partner companies. The shared record behaviour, unextended so far. */

import { STORE } from '@/offline/db/schema.js'
import { createRecordRepository } from '@/offline/repositories/recordRepository.js'

export const companiesRepository = createRecordRepository(STORE.COMPANIES)

export default companiesRepository
