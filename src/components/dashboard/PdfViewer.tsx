export function PdfViewer({ url }: { url: string }) {
    if (!url) return <div className="p-4 text-center text-slate-500">Seleziona un documento per visualizzarlo</div>

    return (
        <div className="w-full h-[80vh] bg-slate-100 rounded-xl overflow-hidden border border-slate-200 shadow-inner">
            <iframe
                src={url}
                className="w-full h-full"
                title="PDF Viewer"
            />
        </div>
    )
}
