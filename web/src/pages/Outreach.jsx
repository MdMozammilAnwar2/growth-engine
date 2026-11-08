import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, ExternalLink, RefreshCw, Check } from 'lucide-react';
import { api } from '../api.js';
import { useApi, Spinner, ErrorNote, PageTitle, Button, Empty, Avatar, Segmented, Card, useToast, cx } from '../ui.jsx';

const KIND = { preview: 'Preview gift · day 0', nudge: 'Gentle nudge · day 4', live: "It's live", thanks: 'Thank-you · no thanks' };
const OPEN_LABEL = { whatsapp: 'Open WhatsApp', linkedin: 'Copy & open LinkedIn', email: 'Open email' };

export default function Outreach() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { data: queue, error, loading, reload } = useApi('/api/messages/queue');
  const [msg, setMsg] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState('');
  const [opened, setOpened] = useState(false);

  const selectedId = params.get('contact') || queue?.[0]?.contact.id;
  const item = queue?.find((q) => q.contact.id === selectedId) || queue?.[0];

  const draft = async (it, extra = {}) => {
    if (!it) return;
    setBusy('draft'); setOpened(false);
    try {
      const m = await api(`/api/contacts/${it.contact.id}/messages/draft`, { method: 'POST', body: { templateKey: it.templateKey, ...extra } });
      setMsg(m); setBody(m.body);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  useEffect(() => { setMsg(null); if (item) draft(item); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [item?.contact.id, item?.templateKey]);

  const saveBody = async () => {
    if (!msg || body === msg.body) return msg;
    const m = await api(`/api/messages/${msg.id}`, { method: 'PATCH', body: { body } });
    setMsg(m); return m;
  };
  const setChannel = async (channel) => {
    const m = await api(`/api/messages/${msg.id}`, { method: 'PATCH', body: { channel, body } });
    setMsg(m);
  };
  const copy = async () => { await saveBody(); await navigator.clipboard.writeText(body); toast('Copied'); };
  const open = async () => {
    const m = await saveBody();
    if (m.channel === 'linkedin') await navigator.clipboard.writeText(body).catch(() => {});
    window.open(m.links.open, '_blank', 'noopener');
    setOpened(true);
  };
  const markSent = async () => {
    setBusy('sent');
    try {
      await saveBody();
      await api(`/api/messages/${msg.id}/sent`, { method: 'POST', body: {} });
      toast(`Marked as sent to ${item.contact.fullName}`);
      setParams({}); setMsg(null); await reload();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(''); }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageTitle title="Send" sub="Messages are drafted for you. You read every one and press send yourself." />
      <ErrorNote error={error} />
      {loading && !queue ? <Spinner /> : !queue?.length ? (
        <Empty title="Nothing to send">Approve a preview and its message appears here.</Empty>
      ) : (
        <div className="flex flex-wrap gap-5 items-start">
          <section aria-label="Queue" className="flex-[1_1_250px] min-w-0">
            <div className="flex lg:flex-col gap-2.5 overflow-x-auto scrollbar-none -mx-4 px-4 lg:mx-0 lg:px-0 lg:rounded-2xl lg:border lg:border-line lg:bg-panel lg:gap-0 lg:overflow-hidden">
              {queue.map((q) => {
                const on = q.contact.id === item?.contact.id;
                return (
                  <button key={`${q.contact.id}-${q.templateKey}`} type="button" onClick={() => setParams({ contact: q.contact.id })} aria-pressed={on}
                    className={cx('shrink-0 flex items-center gap-3 text-left rounded-full lg:rounded-none border lg:border-0 lg:border-t first:lg:border-t-0 border-line-2 lg:border-[#1C1C22] pl-1.5 pr-4 lg:px-4 py-1.5 lg:py-3',
                      on ? 'bg-[#16110E] border-accent lg:bg-raise' : 'bg-panel lg:bg-transparent')}>
                    <Avatar name={q.contact.fullName} size={36} />
                    <span className="flex flex-col min-w-0"><span className="text-sm font-medium truncate">{q.contact.fullName}</span><span className="text-xs text-muted hidden lg:block">{q.reason}</span></span>
                  </button>
                );
              })}
            </div>
          </section>

          <Card className="flex-[2.2_1_440px] min-w-0 flex flex-col">
            <div className="px-5 py-4 flex flex-wrap gap-3 items-center border-b border-line">
              <div className="flex flex-col mr-auto"><span className="text-xs text-muted">{KIND[item?.templateKey]}</span><span className="text-[17px] font-semibold">To {item?.contact.fullName}</span></div>
              {msg && <Segmented label="Channel" value={msg.channel} onChange={setChannel}
                options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'linkedin', label: 'LinkedIn' }, { value: 'email', label: 'Email' }]} />}
            </div>
            <div className="p-4 sm:p-6 bg-[#0D0D10] bg-[radial-gradient(#1C1C22_1px,transparent_1px)] [background-size:16px_16px] flex justify-end">
              {!msg ? <Spinner label="Drafting" /> : (
                <div className="w-full max-w-[540px] rounded-[16px_16px_4px_16px] bg-[#1F2A22] p-3.5 flex flex-col gap-2">
                  <label htmlFor="body" className="sr-only">Message</label>
                  <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} onBlur={saveBody} rows={9}
                    className="w-full bg-transparent text-[#E9F2EC] text-[15px] leading-relaxed outline-none resize-y" />
                  {msg.highlight && <span className="text-[11px] text-[#9DB5A5]">Personal detail: “{msg.highlight}”</span>}
                </div>
              )}
            </div>
            {msg && (
              <div className="px-5 py-4 border-t border-line flex flex-wrap gap-2.5 bg-side rounded-b-2xl">
                <Button size="sm" variant="ghost" onClick={() => draft(item, { regenerate: true, channel: msg.channel })} loading={busy === 'draft'}><RefreshCw className="size-3.5" />Redraft</Button>
                <Button size="sm" onClick={copy}><Copy className="size-3.5" />Copy</Button>
                <span className="flex-1" />
                <Button onClick={markSent} loading={busy === 'sent'} variant={opened ? 'primary' : 'secondary'}><Check className="size-4" />Mark as sent</Button>
                <Button variant={opened ? 'secondary' : 'primary'} onClick={open}>{OPEN_LABEL[msg.channel]}<ExternalLink className="size-4" /></Button>
              </div>
            )}
          </Card>

          <aside className="flex-[1_1_240px] min-w-0">
            <Card className="p-4 flex flex-col gap-2.5 bg-side">
              <h2 className="text-[13px] font-semibold">House rules</h2>
              <ul className="list-disc pl-4 text-[13px] text-muted flex flex-col gap-1.5 leading-relaxed">
                <li>No sales pitch in the first message</li>
                <li>One nudge at most, after 4 days</li>
                <li>“No thanks” gets a thank-you, then silence</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
