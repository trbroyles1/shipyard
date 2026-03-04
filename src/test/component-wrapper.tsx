import type { ReactNode } from "react";
import { PreferencesProvider } from "@/components/providers/PreferencesProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { DetailPatchProvider } from "@/components/providers/DetailPatchProvider";
import { MRSelectionProvider } from "@/components/providers/MRSelectionProvider";
import { UIPanelProvider } from "@/components/providers/UIPanelProvider";
import { FilterSortProvider } from "@/components/providers/FilterSortProvider";

interface WrapperOptions {
  /** Set a preferences cookie value before rendering. */
  preferencesCookie?: string;
}

/**
 * Creates a universal provider wrapper for component/hook tests.
 *
 * SessionProvider from next-auth is expected to be mocked via
 * `vi.mock("next-auth/react")` in each test file that needs it.
 * This wrapper nests the real application providers.
 */
export function createWrapper(options?: WrapperOptions) {
  const { preferencesCookie } = options ?? {};

  return function Wrapper({ children }: { children: ReactNode }) {
    if (preferencesCookie) {
      document.cookie = preferencesCookie;
    }

    return (
      <FilterSortProvider>
        <PreferencesProvider>
          <ToastProvider>
            <DetailPatchProvider>
              <MRSelectionProvider>
                <UIPanelProvider>
                  {children}
                </UIPanelProvider>
              </MRSelectionProvider>
            </DetailPatchProvider>
          </ToastProvider>
        </PreferencesProvider>
      </FilterSortProvider>
    );
  };
}
