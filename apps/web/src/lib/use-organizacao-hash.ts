import { useParams } from "@tanstack/react-router";

export function useOrganizacaoHash() {
  const { organizacaoHash } = useParams({ strict: false });
  return organizacaoHash as string | undefined;
}
