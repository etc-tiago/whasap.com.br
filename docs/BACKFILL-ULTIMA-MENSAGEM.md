# Backfill: realinha `conversa.ultima_mensagem_em` com o max das mensagens.

```sql
UPDATE conversa c
SET ultima_mensagem_em = sub.max_em,
    atualizado_em = now()
FROM (
  SELECT conversa_id, max(criado_em) AS max_em
  FROM mensagem
  WHERE excluido_em IS NULL
  GROUP BY conversa_id
) sub
WHERE c.id = sub.conversa_id
  AND (c.ultima_mensagem_em IS NULL OR c.ultima_mensagem_em < sub.max_em);
```
