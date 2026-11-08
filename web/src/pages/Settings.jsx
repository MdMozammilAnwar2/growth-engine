import { CheckCircle2, XCircle } from 'lucide-react';
import { useApi, Spinner, ErrorNote, PageTitle, Card } from '../ui.jsx';

function Row({ ok, title, children }) {
  return (
    <div className="flex gap-3 py-3.5 border-t first:border-t-0 border-line">
      {ok ? <CheckCircle2 className="size-5 text-ok shrink-0" /> : <XCircle className="size-5 text-warn shrink-0" />}
      <div className="flex flex-col gap-1 min-w-0"><span className="text-[15px] font-medium">{title}</span><span className="text-[13px] text-muted break-words">{children}</span></div>
    </div>
  );
}

export default function Settings() {
  const { data, error, loading } = useApi('/api/settings');
  if (error) return <ErrorNote error={error} />;
  if (loading || !data) return <Spinner />;
  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <PageTitle title="Settings" sub="These come from server/.env. Edit that file and restart the server to change them." />
      <Card className="px-5 py-2">
        <Row ok={data.ai.enabled} title="AI (Anthropic)">
          {data.ai.enabled ? `On · model ${data.ai.model}. Reads PDFs and screenshots, writes copy, picks a personal detail for messages.`
            : 'Off. PDFs use the built-in parser and messages use plain templates. Screenshots need AI: set ANTHROPIC_API_KEY.'}
        </Row>
        <Row ok={data.github.enabled} title="GitHub Pages">
          {data.github.enabled ? `On · repos are created under ${data.github.owner} (${data.github.ownerType}).` : 'Off. Set GITHUB_TOKEN and GITHUB_OWNER to publish sites.'}
        </Row>
        <Row ok={!data.publicBaseUrl.includes('localhost')} title="Preview links">
          {data.publicBaseUrl}{data.publicBaseUrl.includes('localhost') ? ' · friends cannot open localhost links. Deploy the server and set PUBLIC_BASE_URL.' : ''}
        </Row>
        <Row ok title="Credit on every site">“Crafted by {data.credit.name} · {data.credit.line}” → {data.credit.url}</Row>
        <Row ok title="Privacy">After “No thanks”, profile data and photos are deleted after {data.declineRetentionDays} days.</Row>
      </Card>
      <Card className="p-5 flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">Templates</h2>
        <ul className="flex flex-col gap-2">{data.templates.map((t) => <li key={t.id} className="text-sm"><span className="font-medium">{t.name}</span> <span className="text-muted">· {t.description}</span></li>)}</ul>
      </Card>
      <Card className="p-5 flex flex-col gap-2">
        <h2 className="text-[15px] font-semibold">Install on your phone</h2>
        <p className="text-sm text-muted leading-relaxed">Open this app in Chrome on Android (or Safari on iPhone), then choose <span className="text-ink">Add to Home screen</span>. It opens full-screen like an app. For a real Android app, see <span className="font-mono text-xs">mobile-app/README.md</span>.</p>
      </Card>
    </div>
  );
}
