"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ProviderBrandIcon } from "@/components/provider-brand-icon";
import { isNavItemActive, type SidebarNavSection } from "@/components/sidebar-navigation";

interface SidebarNavSectionsProps {
  pathname: string;
  sections: SidebarNavSection[];
  enableAccordion?: boolean;
  bottomSlot?: React.ReactNode;
}

function findActiveCollapsibleSectionId(
  pathname: string,
  sections: SidebarNavSection[],
  enableAccordion: boolean
): string | null {
  if (!enableAccordion) return null;
  for (const section of sections) {
    if (!section.collapsible) continue;
    if (section.items.some((item) => isNavItemActive(pathname, item))) {
      return section.id;
    }
  }
  return null;
}

export function SidebarNavSections({
  pathname,
  sections,
  enableAccordion = false,
  bottomSlot,
}: SidebarNavSectionsProps) {
  const [openSectionId, setOpenSectionId] = useState<string | null>(() =>
    findActiveCollapsibleSectionId(pathname, sections, enableAccordion)
  );

  useEffect(() => {
    const activeSectionId = findActiveCollapsibleSectionId(pathname, sections, enableAccordion);
    if (activeSectionId) {
      setOpenSectionId(activeSectionId);
    }
  }, [pathname, sections, enableAccordion]);

  return (
    <nav
      className={`flex flex-1 select-none flex-col overflow-y-auto p-4 pt-6 text-sm ${
        enableAccordion ? "gap-1" : "gap-5"
      }`}
    >
      {sections.map((section) => {
        const isCollapsible = Boolean(section.collapsible && enableAccordion);
        const isOpen = openSectionId === section.id;
        const hasActiveChild = section.items.some((item) => isNavItemActive(pathname, item));
        const SectionIcon = section.icon ?? section.items[0]?.icon;

        return (
        <section key={section.id} className="flex flex-col gap-1">
          {section.label && !section.collapsible ? (
            <p className="px-3 pb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-brand-muted/80">
              {section.label}
            </p>
          ) : null}
          {section.label && isCollapsible ? (
            <button
              type="button"
              onClick={() =>
                setOpenSectionId((current) => (current === section.id ? null : section.id))
              }
              aria-expanded={isOpen}
              aria-controls={`sidebar-group-${section.id}`}
              className={`sidebar-nav-item mx-2 flex items-center gap-3 px-4 py-3 ${
                hasActiveChild ? "sidebar-nav-item-active" : ""
              }`}
            >
              {SectionIcon ? <SectionIcon className="h-5 w-5 shrink-0" aria-hidden /> : null}
              <span className="min-w-0 flex-1 text-left">{section.label}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-out ${
                  isOpen ? "rotate-180" : ""
                }`}
                aria-hidden
              />
            </button>
          ) : null}
          {isCollapsible ? (
            <div
              id={`sidebar-group-${section.id}`}
              className={`grid transition-all duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="flex flex-col gap-1 pt-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isNavItemActive(pathname, item);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`sidebar-nav-item mx-3 flex items-center gap-2 px-3 py-2 ${
                          isActive ? "sidebar-nav-item-active" : ""
                        }`}
                      >
                        {item.providerBrand ? (
                          <ProviderBrandIcon
                            provider={item.providerBrand}
                            variant="plain"
                            frameClassName="h-4 w-4"
                            className="brand-icon-monochrome h-4 w-4"
                          />
                        ) : (
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1 text-sm">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div id={`sidebar-group-${section.id}`} className="flex flex-col gap-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = isNavItemActive(pathname, item);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-nav-item mx-2 flex items-center gap-3 px-4 py-3 ${
                      isActive ? "sidebar-nav-item-active" : ""
                    }`}
                  >
                    {item.providerBrand ? (
                      <ProviderBrandIcon
                        provider={item.providerBrand}
                        variant="plain"
                        frameClassName="h-5 w-5"
                        className="brand-icon-monochrome h-5 w-5"
                      />
                    ) : (
                      <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      )})}
      {bottomSlot ? <div className="mt-auto pt-2">{bottomSlot}</div> : null}
    </nav>
  );
}
