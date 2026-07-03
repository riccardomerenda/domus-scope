import { type AnalyticalData, type AppConfig } from "../../../persistence/db";
import { CostCatalogSection } from "./CostCatalog";
import {
  AssumptionsSection,
  ConstraintsSection,
  FinancingSection,
  PropertySection,
  RentSection,
  SimulationSection,
} from "./sections";

/**
 * The analytical inputs screen (source-doc flow 11.2): freely navigable
 * sections, not a rigid wizard.
 */
export function InputsPanel({
  data,
  onChange,
  appConfig,
}: {
  data: AnalyticalData;
  onChange: (next: AnalyticalData) => void;
  appConfig: AppConfig;
}) {
  return (
    <div className="space-y-4">
      <PropertySection data={data} onChange={onChange} />
      <CostCatalogSection data={data} onChange={onChange} />
      <FinancingSection data={data} onChange={onChange} />
      <RentSection data={data} onChange={onChange} />
      <AssumptionsSection data={data} onChange={onChange} appConfig={appConfig} />
      <SimulationSection data={data} onChange={onChange} />
      <ConstraintsSection data={data} onChange={onChange} appConfig={appConfig} />
    </div>
  );
}
