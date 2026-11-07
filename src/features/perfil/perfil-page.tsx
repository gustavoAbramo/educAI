import { Camera, Eye, EyeOff, KeyRound, Loader2, Save, Trash2, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BackButton } from "@/components/back-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { minimumPasswordLength, passwordProblem } from "@/lib/password-policy";
import {
  changePassword,
  deleteAccount,
  getAccount,
  updateAccount,
  type AccountProfile,
} from "@/services/accountService";
import { initials, notifyAccountChanged } from "./account-events";

const inputClassName =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-60";
const primaryButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-95 disabled:opacity-60";

// Reduz a foto no navegador antes de enviar: quadrada, 256px, JPEG.
async function resizeAvatar(file: File) {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponível");
  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

function SecretInput({
  label,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className={`${inputClassName} pr-10`}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
          className="absolute top-1/2 right-1.5 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PerfilPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [name, setName] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    getAccount()
      .then((response) => {
        if (!active) return;
        setProfile(response.data);
        setName(response.data.name);
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error ? error.message : "Não foi possível carregar a conta.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const applyProfile = (next: AccountProfile) => {
    setProfile(next);
    notifyAccountChanged(next);
  };

  const saveName = async (event: FormEvent) => {
    event.preventDefault();
    setSavingProfile(true);
    try {
      const response = await updateAccount({ name: name.trim() });
      applyProfile(response.data);
      toast.success("Nome salvo");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o nome.");
    } finally {
      setSavingProfile(false);
    }
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha um arquivo de imagem.");
      return;
    }
    setSavingAvatar(true);
    try {
      const avatar = await resizeAvatar(file);
      const response = await updateAccount({ avatar });
      applyProfile(response.data);
      toast.success("Foto atualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível usar essa imagem.");
    } finally {
      setSavingAvatar(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const removeAvatar = async () => {
    setSavingAvatar(true);
    try {
      const response = await updateAccount({ avatar: null });
      applyProfile(response.data);
      toast.success("Foto removida");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover a foto.");
    } finally {
      setSavingAvatar(false);
    }
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    if (!currentPassword || !newPassword) {
      setPasswordError("Preencha a senha atual e a nova.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação não bate com a nova senha.");
      return;
    }
    const weakness = passwordProblem(newPassword, profile?.email ?? "");
    if (weakness) {
      setPasswordError(`Senha fraca: ${weakness.label.toLowerCase()}.`);
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha alterada");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Não foi possível trocar a senha.");
    } finally {
      setChangingPassword(false);
    }
  };

  const confirmDelete = async () => {
    setDeleteError("");
    if (!deletePassword) {
      setDeleteError("Digite sua senha para confirmar.");
      return;
    }
    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      window.location.replace("/");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Não foi possível excluir a conta.");
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 sm:py-10 animate-fade-in">
      <div className="mb-6">
        <BackButton to="/painel" label="Início" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Perfil e conta</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Seu nome e foto aparecem no topo do app. A senha protege suas aulas.
      </p>

      {loading ? (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando conta...
        </div>
      ) : null}
      {loadError ? (
        <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
        </div>
      ) : null}

      {profile ? (
        <div className="mt-8 space-y-5">
          <section className="rounded-xl border border-border/60 bg-card">
            <div className="border-b border-border/60 px-5 py-4">
              <h2 className="text-sm font-semibold">Dados do perfil</h2>
            </div>
            <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-3">
                <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full bg-gradient-brand-soft text-2xl font-semibold text-primary">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt="Sua foto"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span aria-hidden>{initials(profile)}</span>
                  )}
                </div>
                <input
                  ref={fileInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  aria-label="Escolher foto"
                  onChange={(event) => void pickAvatar(event.target.files?.[0])}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={savingAvatar}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-xs transition hover:bg-muted disabled:opacity-60"
                  >
                    {savingAvatar ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Camera className="h-3.5 w-3.5" />
                    )}
                    {profile.avatar ? "Trocar" : "Adicionar foto"}
                  </button>
                  {profile.avatar ? (
                    <button
                      type="button"
                      onClick={() => void removeAvatar()}
                      disabled={savingAvatar}
                      className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              </div>

              <form onSubmit={(event) => void saveName(event)} className="grid flex-1 gap-4">
                <div>
                  <label
                    htmlFor="perfil-nome"
                    className="mb-1 block text-xs font-medium text-muted-foreground"
                  >
                    Nome
                  </label>
                  <input
                    id="perfil-nome"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    autoComplete="name"
                    placeholder="Como você quer ser chamado(a)"
                    className={inputClassName}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">E-mail</div>
                  <div className="flex h-10 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
                    {profile.email || "—"}
                  </div>
                  {profile.isAdmin ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Conta de administração, definida no servidor.
                    </p>
                  ) : null}
                </div>
                <div>
                  <button
                    type="submit"
                    disabled={savingProfile || name.trim() === profile.name}
                    className={primaryButton}
                  >
                    {savingProfile ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Salvar nome
                  </button>
                </div>
              </form>
            </div>
          </section>

          {profile.canChangePassword ? (
            <section className="rounded-xl border border-border/60 bg-card">
              <div className="border-b border-border/60 px-5 py-4">
                <h2 className="text-sm font-semibold">Trocar senha</h2>
              </div>
              <form onSubmit={(event) => void submitPassword(event)} className="grid gap-4 p-5">
                <SecretInput
                  label="Senha atual"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  autoComplete="current-password"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SecretInput
                    label="Nova senha"
                    value={newPassword}
                    onChange={setNewPassword}
                    autoComplete="new-password"
                    hint={`Pelo menos ${minimumPasswordLength} caracteres.`}
                  />
                  <SecretInput
                    label="Confirmar nova senha"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                  />
                </div>
                {passwordError ? (
                  <p role="alert" className="text-xs text-destructive">
                    {passwordError}
                  </p>
                ) : null}
                <div>
                  <button type="submit" disabled={changingPassword} className={primaryButton}>
                    {changingPassword ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    Trocar senha
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {profile.canDelete ? (
            <section className="rounded-xl border border-destructive/30 bg-card">
              <div className="border-b border-destructive/20 px-5 py-4">
                <h2 className="text-sm font-semibold text-destructive">Excluir conta</h2>
              </div>
              <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Apaga a conta e todas as suas aulas, áudios, transcrições e materiais. Não dá para
                  desfazer.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setDeletePassword("");
                    setDeleteError("");
                    setDeleteOpen(true);
                  }}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-destructive/40 px-4 text-sm font-medium text-destructive transition hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir conta
                </button>
              </div>
            </section>
          ) : (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5" />A senha e a exclusão desta conta são controladas
              pelo servidor.
            </p>
          )}
        </div>
      ) : null}

      <AlertDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (!deleting) setDeleteOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as suas aulas e arquivos serão apagados agora. Digite sua senha para confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <SecretInput
            label="Senha"
            value={deletePassword}
            onChange={setDeletePassword}
            autoComplete="current-password"
          />
          {deleteError ? (
            <p role="alert" className="text-xs text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir de vez"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
