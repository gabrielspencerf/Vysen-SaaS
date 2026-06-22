"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";

interface ProfileAvatarSectionProps {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  onAvatarChange: (nextUrl: string | null) => void;
  onError: (message: string) => void;
  onSuccess: (message: string) => void;
}

export function ProfileAvatarSection({
  displayName,
  email,
  avatarUrl,
  onAvatarChange,
  onError,
  onSuccess,
}: ProfileAvatarSectionProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const initials = (displayName.trim() || email).slice(0, 1).toUpperCase();

  function broadcastProfileUpdate(detail: { name?: string | null; avatarUrl?: string | null }) {
    window.dispatchEvent(new CustomEvent("vysen-profile-updated", { detail }));
  }

  async function persistAvatar(nextUrl: string | null) {
    const res = await fetch("/api/context/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: nextUrl }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Não foi possível atualizar avatar");
    }
  }

  async function handleAvatarUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      onError("Selecione apenas arquivo de imagem.");
      event.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      onError("Imagem deve ter no máximo 5 MB.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("kind", "photo");
      formData.set("displayName", `avatar-${Date.now()}-${file.name}`);
      const uploadRes = await fetch("/api/dashboard/tenant-assets", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json().catch(() => ({}));
      if (!uploadRes.ok || !uploadData?.id) {
        onError(uploadData.error ?? "Não foi possível enviar o avatar.");
        return;
      }
      const persistedUrl = `/api/dashboard/tenant-assets/${uploadData.id}/file`;
      await persistAvatar(persistedUrl);
      const displayUrl = `${persistedUrl}?v=${Date.now()}`;
      onAvatarChange(displayUrl);
      broadcastProfileUpdate({ name: displayName, avatarUrl: displayUrl });
      onSuccess("Avatar atualizado com sucesso.");
    } catch {
      onError("Falha ao enviar avatar.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setRemoving(true);
    try {
      await persistAvatar(null);
      onAvatarChange(null);
      broadcastProfileUpdate({ name: displayName, avatarUrl: null });
      onSuccess("Avatar removido.");
    } catch {
      onError("Não foi possível remover avatar.");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card className="mt-6 border-brand-border bg-brand-surface">
      <CardContent className="p-6">
        <h2 className="text-base font-semibold text-brand-text">Avatar do perfil</h2>
        <p className="mt-1 text-sm text-brand-muted">
          Personalize sua conta com uma foto. Formatos aceitos: imagem, até 5 MB.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-brand-border bg-brand-surface/70 text-lg font-semibold text-brand-text">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={`Avatar de ${displayName || email}`} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploading || removing}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={uploading || removing}
              className="gap-2 border-brand-border"
            >
              <ImagePlus className="h-4 w-4" />
              {uploading ? "Enviando..." : "Adicionar avatar"}
            </Button>
            {avatarUrl && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleRemoveAvatar}
                disabled={uploading || removing}
                className="gap-2 border-brand-border text-red-300 hover:text-red-200"
              >
                <Trash2 className="h-4 w-4" />
                {removing ? "Removendo..." : "Remover"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
