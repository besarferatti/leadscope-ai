import React from 'react';
import { getStatusColor } from '../../lib/utils';

interface Props {
  status: string;
}

export function StatusBadge({ status }: Props) {
  return (
    <span className={`badge ${getStatusColor(status)}`}>
      {status}
    </span>
  );
}
