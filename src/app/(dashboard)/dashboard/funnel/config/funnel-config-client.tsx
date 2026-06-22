"use client";

import { useState } from "react";
import { Button, Input, Card, CardContent } from "@/components/ui";
import { CheckCircle2, Filter, Plus, Trash2, GripVertical, Star, TriangleAlert } from "lucide-react";

type FunnelStep = {
  id: string;
  funnelId: string;
  name: string;
  sortOrder: number;
  criteria: Record<string, unknown> | null;
};

type FunnelWithSteps = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  steps: FunnelStep[];
};

export function FunnelConfigClient({
  initialFunnels,
  defaultFunnelId,
}: {
  initialFunnels: FunnelWithSteps[];
  defaultFunnelId: string | null;
}) {
  const [funnels, setFunnels] = useState<FunnelWithSteps[]>(initialFunnels);
  const [defaultId, setDefaultId] = useState<string | null>(defaultFunnelId);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [addingStepFor, setAddingStepFor] = useState<string | null>(null);
  const [newStepName, setNewStepName] = useState("");
  const [editingFunnelId, setEditingFunnelId] = useState<string | null>(null);
  const [editingFunnelName, setEditingFunnelName] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepName, setEditingStepName] = useState("");

  function clearFeedback() {
    setError(null);
    setSuccess(null);
  }

  async function loadFunnels() {
    try {
      const res = await fetch("/api/dashboard/funnels");
      if (!res.ok) return;
      const list = await res.json();
      const withSteps = await Promise.all(
        list.map((f: { id: string }) =>
          fetch(`/api/dashboard/funnels/${f.id}`).then((r) => r.json())
        )
      );
      setFunnels(withSteps.filter(Boolean));
    } catch {
      setError("Falha ao carregar funis");
    }
  }

  async function loadDefault() {
    const res = await fetch("/api/dashboard/funnels/default");
    if (res.ok) {
      const data = await res.json();
      setDefaultId(data.defaultFunnelId ?? null);
    }
  }

  async function handleCreateFunnel(e: React.FormEvent) {
    e.preventDefault();
    clearFeedback();
    const name = newName.trim();
    if (!name) {
      setError("Nome do funil é obrigatório");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/dashboard/funnels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao criar funil");
        return;
      }
      setNewName("");
      setSuccess("Funil criado.");
      await loadFunnels();
    } catch {
      setError("Falha de conexão");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdateFunnel(funnelId: string, name: string) {
    clearFeedback();
    if (!name.trim()) return;
    try {
      const res = await fetch(`/api/dashboard/funnels/${funnelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao atualizar");
        return;
      }
      setEditingFunnelId(null);
      setSuccess("Funil atualizado.");
      await loadFunnels();
    } catch {
      setError("Falha de conexão");
    }
  }

  async function handleDeleteFunnel(funnelId: string) {
    if (!confirm("Excluir este funil? As etapas serão removidas. Leads vinculados ficarão sem funil.")) return;
    clearFeedback();
    try {
      const res = await fetch(`/api/dashboard/funnels/${funnelId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Erro ao excluir");
        return;
      }
      if (defaultId === funnelId) await loadDefault();
      setSuccess("Funil excluído.");
      await loadFunnels();
    } catch {
      setError("Falha de conexão");
    }
  }

  async function handleSetDefault(funnelId: string) {
    clearFeedback();
    try {
      const res = await fetch("/api/dashboard/funnels/default", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funnelId }),
      });
      if (!res.ok) return;
      setDefaultId(funnelId);
      setSuccess("Funil padrão definido.");
    } catch {
      setError("Falha de conexão");
    }
  }

  async function handleAddStep(funnelId: string) {
    const name = newStepName.trim();
    if (!name) {
      setError("Nome da etapa é obrigatório");
      return;
    }
    setAddingStepFor(funnelId);
    clearFeedback();
    try {
      const res = await fetch(`/api/dashboard/funnels/${funnelId}/steps`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Erro ao adicionar etapa");
        return;
      }
      setNewStepName("");
      setAddingStepFor(null);
      setSuccess("Etapa adicionada.");
      await loadFunnels();
    } catch {
      setError("Falha de conexão");
    } finally {
      setAddingStepFor(null);
    }
  }

  async function handleUpdateStep(funnelId: string, stepId: string, name: string) {
    if (!name.trim()) return;
    clearFeedback();
    try {
      const res = await fetch(`/api/dashboard/funnels/${funnelId}/steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) return;
      setEditingStepId(null);
      setSuccess("Etapa atualizada.");
      await loadFunnels();
    } catch {
      setError("Falha de conexão");
    }
  }

  async function handleDeleteStep(funnelId: string, stepId: string) {
    if (!confirm("Remover esta etapa?")) return;
    clearFeedback();
    try {
      const res = await fetch(`/api/dashboard/funnels/${funnelId}/steps/${stepId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setSuccess("Etapa removida.");
      await loadFunnels();
    } catch {
      setError("Falha de conexão");
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/35 bg-red-500/12 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="font-medium">{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="font-semibold">{success}</p>
        </div>
      )}

      <Card className="border-brand-border bg-brand-surface">
        <CardContent className="p-6">
          <h2 className="text-base font-semibold text-brand-text">Novo funil</h2>
          <p className="mt-1 text-sm text-brand-muted">
            Crie um funil e depois adicione as etapas na ordem desejada.
          </p>
          <form onSubmit={handleCreateFunnel} className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-sm font-medium text-brand-muted" htmlFor="new_funnel_name">
                Nome do funil
              </label>
              <Input
                id="new_funnel_name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex.: Vendas B2B"
                className="mt-1 w-64"
                maxLength={255}
              />
            </div>
            <Button type="submit" disabled={creating}>
              {creating ? "Criando…" : "Criar funil"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {funnels.length === 0 ? (
        <Card className="border-brand-border bg-brand-surface">
          <CardContent className="p-8 text-center">
            <Filter className="mx-auto h-10 w-10 text-brand-muted" />
            <p className="mt-2 text-sm text-brand-muted">
              Nenhum funil ainda. Crie um acima para configurar as etapas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {funnels.map((funnel) => (
            <Card key={funnel.id} className="border-brand-border bg-brand-surface">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {editingFunnelId === funnel.id ? (
                      <>
                        <Input
                          value={editingFunnelName}
                          onChange={(e) => setEditingFunnelName(e.target.value)}
                          className="w-56"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleUpdateFunnel(funnel.id, editingFunnelName)}
                        >
                          Salvar
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingFunnelId(null)}
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <>
                        <h3 className="text-base font-semibold text-brand-text">
                          {funnel.name}
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFunnelId(funnel.id);
                            setEditingFunnelName(funnel.name);
                          }}
                          className="text-sm text-brand-muted hover:text-brand-neon"
                        >
                          Editar nome
                        </button>
                        {defaultId === funnel.id && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-neon/20 px-2 py-0.5 text-xs font-medium text-brand-neon">
                            <Star className="h-3 w-3" /> Padrão
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {defaultId !== funnel.id && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleSetDefault(funnel.id)}
                      >
                        Definir como padrão
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteFunnel(funnel.id)}
                      className="text-brand-muted hover:text-red-500"
                      aria-label="Excluir funil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-medium text-brand-muted">Etapas (ordem)</p>
                  <ul className="mt-2 space-y-2">
                    {funnel.steps
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((step) => (
                        <li
                          key={step.id}
                          className="flex items-center gap-2 rounded-lg border border-brand-border bg-brand-surface/50 px-3 py-2"
                        >
                          <GripVertical className="h-4 w-4 text-brand-muted" />
                          {editingStepId === step.id ? (
                            <>
                              <Input
                                value={editingStepName}
                                onChange={(e) => setEditingStepName(e.target.value)}
                                className="flex-1"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() =>
                                  handleUpdateStep(funnel.id, step.id, editingStepName)
                                }
                              >
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setEditingStepId(null)}
                              >
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-sm font-medium text-brand-text">
                                {step.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStepId(step.id);
                                  setEditingStepName(step.name);
                                }}
                                className="text-xs text-brand-muted hover:text-brand-neon"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStep(funnel.id, step.id)}
                                className="text-brand-muted hover:text-red-500"
                                aria-label="Excluir etapa"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                  </ul>

                  {addingStepFor === funnel.id ? (
                    <div className="mt-3 flex items-center gap-2">
                      <Input
                        value={newStepName}
                        onChange={(e) => setNewStepName(e.target.value)}
                        placeholder="Nome da nova etapa"
                        className="flex-1 max-w-xs"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddStep(funnel.id);
                          if (e.key === "Escape") setAddingStepFor(null);
                        }}
                      />
                      <Button
                        size="sm"
                        onClick={() => handleAddStep(funnel.id)}
                        disabled={!newStepName.trim()}
                      >
                        Adicionar
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAddingStepFor(null);
                          setNewStepName("");
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => setAddingStepFor(funnel.id)}
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Adicionar etapa
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
