import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui";
import { Activity, ExternalLink, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandMark } from "@/components/brand-mark";
import { SEO_APP_NAME } from "./seo";

const CNPJ_FORMATTED = "35.050.841/0001-98";

export const metadata: Metadata = {
  title: "Observabilidade e gestao operacional",
  description:
    "Centralize leads, conversas e funis em uma plataforma de observabilidade operacional com IA.",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: `${SEO_APP_NAME} | Observabilidade e gestao operacional`,
    description:
      "Centralize leads, conversas e funis em uma plataforma de observabilidade operacional com IA.",
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SEO_APP_NAME} | Observabilidade e gestao operacional`,
    description:
      "Centralize leads, conversas e funis em uma plataforma de observabilidade operacional com IA.",
  },
};

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col bg-brand-dark overflow-hidden relative">
      {/* Elementos de Fundo Animados e Luzes */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Grid de fundo com máscara de esmaecimento */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#00c8820a_1px,transparent_1px),linear-gradient(to_bottom,#00c8820a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 animate-[grid-move_20s_linear_infinite]"></div>
        
        {/* Orbes de luz pulsante / Blur */}
        <div className="absolute top-[10%] left-[50%] -translate-x-1/2 w-[600px] h-[600px] bg-brand-neon/10 rounded-full blur-[140px] animate-pulse-slow"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[400px] h-[400px] bg-brand-neon/5 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-[30%] left-[10%] w-[300px] h-[300px] bg-brand-neon/5 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
      </div>

      <nav className="relative z-10 flex w-full items-center justify-between py-6 px-6 sm:px-12 border-b border-brand-border/30">
        <BrandMark size="sm" />
        <div className="flex items-center gap-4">
          <ThemeToggle />
        </div>
      </nav>

      {/* Área central: Bloco principal simulando o card da referência (Acesso ChatHub) */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center p-4 sm:p-8">
        
        {/* Container que imita o box do site com borda e fundo preenchido */}
        <div className="landing-hero-shell group relative flex w-full max-w-5xl flex-col items-center justify-between gap-10 overflow-hidden rounded-3xl border border-brand-border/40 p-8 backdrop-blur-xl transition-all duration-700 hover:border-brand-neon/30 md:flex-row sm:p-12 md:p-16 animate-fade-in">
          
          {/* Efeitos de luz interna no container */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-neon/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
          <div className="absolute bottom-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-brand-neon/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-100"></div>

          {/* Lado esquerdo: Textos e botões */}
          <div className="relative z-10 flex-1 flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 rounded-md border border-brand-neon/30 bg-brand-neon/10 px-3 py-1 text-[11px] font-bold text-brand-neon mb-6 tracking-widest uppercase shadow-[0_0_15px_-3px_rgba(var(--color-brand-neon),0.2)]">
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-neon opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-neon"></span>
              </span>
              Live Data Center
            </div>

            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-brand-text leading-[1.1] mb-5">
              BI <span className="text-brand-neon text-transparent bg-clip-text bg-gradient-to-r from-brand-neon to-brand-neon/70 drop-shadow-[0_0_15px_rgba(0,200,130,0.4)]">Dashboard</span>
            </h1>
            
            <p className="text-brand-muted mb-8 leading-relaxed font-light sm:text-lg max-w-md">
              Plataforma de inteligência para gestão de leads, observabilidade de conversas e atualização de status via agentes de IA. Centralize sua operação.
            </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
            <Link href="/login" className="w-full sm:w-auto">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full sm:w-auto text-[15px] font-bold px-6 h-12 gap-2 shadow-[0_4px_20px_-5px_rgba(var(--color-brand-neon),0.5)] border border-brand-neon rounded-lg tracking-tight"
              >
                Área do Cliente
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center justify-center gap-2 text-sm text-brand-muted/70 font-medium w-full sm:w-auto">
              <Lock className="h-4 w-4" />
              Ambiente Criptografado
            </div>
          </div>
          </div>

          {/* Lado direito: Ilustração do painel simulado */}
          <div className="landing-panel relative z-10 flex w-full max-w-md flex-1 flex-col overflow-hidden rounded-2xl border border-brand-border/50 p-4 opacity-90 transition-colors duration-700 group-hover:border-brand-neon/40">
            
            {/* Reflexo animado varrendo a tela */}
            <div className="absolute top-0 -left-[100%] w-[50%] h-full bg-gradient-to-r from-transparent via-brand-neon/5 to-transparent -skew-x-12 animate-[shimmer_3s_infinite_ease-in-out] pointer-events-none"></div>

            {/* Header de janela fake */}
            <div className="flex items-center justify-between mb-4 border-b border-brand-border/30 pb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-brand-border/60"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-brand-border/60"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-brand-border/60"></div>
              </div>
              <div className="text-[10px] text-brand-muted uppercase tracking-widest">
                Lead Score IA
              </div>
            </div>
            
            {/* Corpo do BI fake */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-brand-muted uppercase tracking-wider">Total Revenue</span>
                  <span className="text-2xl font-display font-bold text-brand-text">$420k</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-brand-neon/10 border border-brand-neon/20 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-brand-neon" />
                </div>
              </div>
              
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-brand-muted font-medium">Leads Qualificados (IA)</span>
                  <span className="text-brand-neon font-bold">8.400</span>
                </div>
                <div className="w-full bg-brand-border/20 rounded-full h-1.5">
                  <div className="bg-brand-neon h-1.5 rounded-full" style={{ width: '75%' }}></div>
                </div>
              </div>
              <div className="space-y-1.5 mt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-brand-muted font-medium">Oportunidades</span>
                  <span className="text-brand-text font-bold">3.120</span>
                </div>
                <div className="w-full bg-brand-border/20 rounded-full h-1.5">
                  <div className="bg-brand-neon h-1.5 rounded-full opacity-60" style={{ width: '40%' }}></div>
                </div>
              </div>

              {/* Tabela fake */}
              <div className="mt-4 rounded-lg border border-brand-border/30 bg-brand-dark/70 p-3">
                <div className="flex justify-between items-center mb-3">
                  <div className="h-2 w-16 bg-brand-border/50 rounded"></div>
                  <div className="h-2 w-12 bg-brand-border/30 rounded"></div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-brand-border/30 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-brand-neon rounded-full"></div>
                      </div>
                      <div className="h-1.5 w-20 bg-brand-border/40 rounded"></div>
                    </div>
                    <div className="h-1.5 w-8 bg-brand-neon/80 rounded"></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-brand-border/30"></div>
                      <div className="h-1.5 w-16 bg-brand-border/40 rounded"></div>
                    </div>
                    <div className="h-1.5 w-8 bg-brand-border/60 rounded"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <footer className="relative z-10 shrink-0 py-8 px-8 sm:px-12 border-t border-brand-border/30 bg-brand-dark flex flex-col items-center justify-center">
        <div className="text-sm text-brand-muted font-medium">Vysen</div>
        <div className="mt-1 text-xs text-brand-muted/70">
          Vysen — CNPJ {CNPJ_FORMATTED}
        </div>
      </footer>
    </main>
  );
}
