import type { EnquiryStatus } from '@/server/enquiries'

export const TONE: Record<EnquiryStatus, string> = { new: 'bg-cyan-50 text-cyan-700', in_progress: 'bg-[#fff4e0] text-[#8a5300]', resolved: 'bg-mist text-muted' }
