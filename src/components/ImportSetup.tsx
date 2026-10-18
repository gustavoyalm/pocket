import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { env } from '@/lib/env';
import { useCreateImportToken, useImportTokens, useRevokeImportToken } from '@/lib/imports';
import { Button } from './ui/button';
import { Input, Label } from './ui/input';

const dateFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/** Configuração do n8n: token de importação e exemplo de chamada. */
export function ImportSetup() {
  const { data: tokens } = useImportTokens();
  const create = useCreateImportToken();
  const revoke = useRevokeImportToken();
  const [label, setLabel] = useState('n8n');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  const endpoint = `${env.supabaseUrl}/rest/v1/rpc/ingest_import_items`;
  const example = `POST ${endpoint}

Headers:
  apikey: ${env.supabaseKey}
  Content-Type: application/json

Body:
{
  "p_token": "${newToken ?? 'SEU_TOKEN_pkt_...'}",
  "p_items": [
    // as transações da Pluggy, do jeito que vêm (sem mapear)
    {
      "id": "3d1154e4-...",
      "description": "Shein *Shein.Com 11/12",
      "amount": 13.54,
      "date": "2027-05-29T03:00:00.000Z",
      "category": "Clothing",
      "type": "DEBIT",
      "operationType": "PAGAMENTO",
      "creditCardMetadata": {
        "cardNumber": "2400",
        "purchaseDate": "2026-07-28T18:22:15.001Z",
        "installmentNumber": 11,
        "totalInstallments": 12,
        "billForecastDate": "2027-06"
      }
    }
  ]
}`;

  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-2">
        <h3 className="font-medium">Token de importação</h3>
        <p className="text-muted-foreground text-xs">
          O n8n usa este token para enviar transações para a caixa de entrada. Ele não dá acesso a mais nada da
          sua conta. O token aparece uma única vez — guarde-o no n8n.
        </p>

        {newToken ? (
          <div className="border-success/40 bg-success/10 space-y-2 rounded-md border p-3">
            <p className="text-xs font-medium">Token gerado. Copie agora — ele não será mostrado de novo:</p>
            <CopyField value={newToken} />
            <Button size="sm" variant="outline" onClick={() => setNewToken(null)}>
              Já copiei
            </Button>
          </div>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setNewToken(await create.mutateAsync(label));
            }}
          >
            <div className="flex-1 space-y-1">
              <Label htmlFor="tok-label" className="text-xs">
                Nome (para você reconhecer)
              </Label>
              <Input id="tok-label" className="h-8" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} />
            </div>
            <Button size="sm" type="submit" disabled={create.isPending}>
              Gerar token
            </Button>
          </form>
        )}
        {create.error && <p className="text-destructive text-xs">{create.error.message}</p>}

        {!!tokens?.length && (
          <ul className="divide-y rounded-md border">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                <span className="font-medium">{t.label}</span>
                <span className="money text-muted-foreground">pkt_…{t.token_hint}</span>
                <span className="text-muted-foreground">
                  {t.last_used_at ? `usado em ${dateFmt.format(new Date(t.last_used_at))}` : 'nunca usado'}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive ml-auto h-6"
                  onClick={() => {
                    if (confirmRevoke !== t.id) return setConfirmRevoke(t.id);
                    revoke.mutate(t.id);
                    setConfirmRevoke(null);
                  }}
                >
                  {confirmRevoke === t.id ? 'Confirmar' : 'Revogar'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-medium">Chamada no n8n (nó HTTP Request)</h3>
        <p className="text-muted-foreground text-xs">
          Envie as transações da Pluggy <strong>do jeito que vêm</strong> (um item ou uma lista, até 1000 por chamada).
          Itens com o mesmo <code className="money">id</code> são ignorados, então dá pra reenviar sem duplicar. O
          final do cartão (<code className="money">cardNumber</code>) acha o cartão — cadastre os finais em Contas.
          Pagamentos de fatura são ignorados automaticamente.
        </p>
        <div className="relative">
          <pre className="bg-muted money max-h-72 overflow-auto rounded-md p-3 text-[11px] leading-relaxed">{example}</pre>
          <div className="absolute top-2 right-2">
            <CopyButton value={example} />
          </div>
        </div>
      </section>
    </div>
  );
}

function CopyField({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="bg-background money flex-1 truncate rounded border px-2 py-1.5 text-xs">{value}</code>
      <CopyButton value={value} />
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="size-7"
      aria-label="Copiar"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}
