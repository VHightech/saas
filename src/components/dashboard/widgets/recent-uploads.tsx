'use client'

import { FileText, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { it } from "date-fns/locale"

interface ImportLog {
    id: number;
    filename: string;
    status: 'success' | 'error' | 'pending';
    created_at: string;
    admin_name?: string;
}

interface RecentUploadsProps {
    uploads?: ImportLog[];
}

export function RecentUploads({ uploads = [] }: RecentUploadsProps) {
    if (!uploads.length) {
        return (
            <div className="p-8 text-center bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10">
                <FileText className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">No recent uploads</h3>
                <p className="text-xs text-slate-500">Files uploaded by admins will appear here.</p>
            </div>
        )
    }

    return (
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Clock size={16} className="text-indigo-500" /> Recent Uploads
                </h3>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 dark:bg-white/10 px-2 py-1 rounded-full">{uploads.length} new</span>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
                {uploads.map((log) => (
                    <div key={log.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <div className={`p-2 rounded-lg ${log.status === 'success' ? 'bg-green-50 text-green-600 dark:bg-green-500/10' :
                                log.status === 'error' ? 'bg-red-50 text-red-600 dark:bg-red-500/10' :
                                    'bg-amber-50 text-amber-600 dark:bg-amber-500/10'
                            }`}>
                            <FileText size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{log.filename}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>by {log.admin_name || 'System'}</span>
                                <span>•</span>
                                <span>{formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: it })}</span>
                            </div>
                        </div>
                        <div>
                            {log.status === 'success' && <CheckCircle size={16} className="text-green-500" />}
                            {log.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                            {log.status === 'pending' && <Clock size={16} className="text-amber-500 animate-pulse" />}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
