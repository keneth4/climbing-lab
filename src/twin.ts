import type { Transform, Point } from '../shared/alignment';
export type Capture = {
  id: string;
  filename: string;
  size: number;
  status: 'draft' | 'published';
  upload_state: string;
  version: number;
  transform: Transform;
  alignment: {
    rms: number;
    references: { id: string; observed: Point }[];
  } | null;
  fileUrl: string;
};
export type Section = {
  id: string;
  name: string;
  bounds: { min: Point; max: Point };
};
export type Fiducial = { id: string; label: string; position: Point };
