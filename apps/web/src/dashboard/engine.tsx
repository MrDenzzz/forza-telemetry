'use client';

import { useFrameValue } from '@ft/live-client/react';

import { Panel } from './panel';
import { StatList } from './stat-list';

const WATTS_PER_HORSEPOWER = 745.7;

export function Engine() {
  // Power and torque turn negative under engine braking; the readout shows what is delivered.
  const horsepower = useFrameValue(
    (frame) => Math.max(0, Math.round(frame.power / WATTS_PER_HORSEPOWER)),
    0,
  );
  const torque = useFrameValue((frame) => Math.max(0, Math.round(frame.torque)), 0);
  const boost = useFrameValue((frame) => Math.round(frame.boost * 10) / 10, 0);

  return (
    <Panel title="Engine">
      <StatList
        items={[
          { label: 'Power', value: `${horsepower} hp` },
          { label: 'Torque', value: `${torque} N·m` },
          { label: 'Boost', value: `${boost.toFixed(1)} psi` },
        ]}
      />
    </Panel>
  );
}
