import { type QuickRuleAssessment } from "@domus-scope/engine";
import { formatPercent } from "../../lib/format";

/**
 * Bullet-style gauge: the measured rent-to-price ratio R (ink marker) against
 * the derived threshold R* with its grey band (recessive fill). Everything is
 * direct-labeled; text wears ink tokens, never series colors (dataviz rules).
 */
export function RuleGauge({ rule }: { rule: QuickRuleAssessment }) {
  const width = 600;
  const left = 14;
  const right = width - 14;
  const axisY = 60;

  const maxValue = niceCeilPercent(
    Math.max(rule.rentToPrice, rule.threshold + rule.greyBand) * 1.25,
  );
  const x = (value: number) => left + (Math.min(value, maxValue) / maxValue) * (right - left);
  const clampLabel = (px: number) => Math.max(40, Math.min(width - 40, px));

  const bandStart = x(Math.max(rule.threshold - rule.greyBand, 0));
  const bandEnd = x(rule.threshold + rule.greyBand);
  const markerX = x(rule.rentToPrice);

  return (
    <svg
      viewBox={`0 0 ${width} 92`}
      className="w-full"
      role="img"
      aria-label={`Rent-to-price ratio ${formatPercent(rule.rentToPrice, 1)} against the derived threshold ${formatPercent(rule.threshold, 1)} (grey band ±${formatPercent(rule.greyBand, 1)})`}
    >
      {/* grey band around R* */}
      <rect
        x={bandStart}
        y={axisY - 20}
        width={Math.max(bandEnd - bandStart, 2)}
        height={20}
        rx={3}
        fill="var(--ds-hairline)"
      />
      {/* axis */}
      <line
        x1={left}
        y1={axisY}
        x2={right}
        y2={axisY}
        stroke="var(--ds-baseline)"
        strokeWidth={1}
      />
      {/* R* tick */}
      <line
        x1={x(rule.threshold)}
        y1={axisY - 26}
        x2={x(rule.threshold)}
        y2={axisY + 6}
        stroke="var(--ds-ink-3)"
        strokeWidth={1}
        strokeDasharray="3 2"
      />
      <text
        x={clampLabel(x(rule.threshold))}
        y={axisY + 20}
        textAnchor="middle"
        fontSize={11}
        fill="var(--ds-ink-2)"
        className="nums"
      >
        R* {formatPercent(rule.threshold, 1)} ± {formatPercent(rule.greyBand, 1)}
      </text>
      {/* R marker */}
      <line
        x1={markerX}
        y1={axisY - 34}
        x2={markerX}
        y2={axisY}
        stroke="var(--ds-ink)"
        strokeWidth={2}
      />
      <circle cx={markerX} cy={axisY - 34} r={3.5} fill="var(--ds-ink)" />
      <text
        x={clampLabel(markerX)}
        y={axisY - 44}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="var(--ds-ink)"
        className="nums"
      >
        R {formatPercent(rule.rentToPrice, 1)}
      </text>
      {/* scale extremes */}
      <text x={left} y={axisY + 20} fontSize={10} fill="var(--ds-ink-3)" className="nums">
        0%
      </text>
      <text
        x={right}
        y={axisY + 20}
        textAnchor="end"
        fontSize={10}
        fill="var(--ds-ink-3)"
        className="nums"
      >
        {formatPercent(maxValue, 0)}
      </text>
    </svg>
  );
}

/** Rounds up to the next whole percent so the scale ends on a clean tick. */
function niceCeilPercent(value: number): number {
  return Math.max(Math.ceil(value * 100) / 100, 0.01);
}
