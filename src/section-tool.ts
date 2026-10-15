import type { Point } from '../shared/alignment';
import type { Section } from './twin';
import type { CameraView, Hold3D } from './domain';
export type SectionTool = {
  active: boolean;
  focusRequest: number;
  focusPoint?: Point;
  section?: Section;
  markers: Hold3D[];
  selected?: string;
  picking: boolean;
  pick: (world: Point) => void;
  select: (id: string) => void;
  cancel: () => void;
  setPicking: (value: boolean) => void;
  camera?: {
    id: number;
    view?: CameraView;
    plane?: import('../shared/sections').OrientedPlane;
  };
};
