'use client';
import {
  X, Check, CircleCheck, CircleX, FileText, MapPin, Search, TriangleAlert, Download, Building2,
  Settings, Bell, User, FolderOpen, RefreshCw, PencilLine, Save, House, CircleDot, Trash2, Clock,
  Flame, Paperclip, ClipboardList, ChartColumn, Calendar, PartyPopper, Pencil, Link, Phone, BookOpen,
  Users, Factory, Trophy, Ban, Zap, Menu, Camera, Lightbulb, Hand, Info, CloudUpload, ShieldCheck} from 'lucide-react';

// One icon set for the whole site (Lucide). Sized in `em` by default so an icon
// dropped into a line of text matches that text, and coloured by `currentColor`.
const ICONS = {
  x: X, check: Check, 'check-circle': CircleCheck, 'x-circle': CircleX, file: FileText, pin: MapPin,
  search: Search, alert: TriangleAlert, download: Download, building: Building2, settings: Settings,
  bell: Bell, user: User, folder: FolderOpen, refresh: RefreshCw, note: PencilLine, save: Save,
  home: House, dot: CircleDot, trash: Trash2, clock: Clock, flame: Flame, clip: Paperclip,
  clipboard: ClipboardList, chart: ChartColumn, calendar: Calendar, party: PartyPopper, pencil: Pencil,
  link: Link, phone: Phone, book: BookOpen, users: Users, factory: Factory, trophy: Trophy, ban: Ban,
  zap: Zap, menu: Menu, camera: Camera, idea: Lightbulb, hand: Hand, info: Info, upload: CloudUpload,
  shield: ShieldCheck,
};

export default function Icon({ name, size = '1.1em', strokeWidth = 2, style, ...rest }) {
  const Cmp = ICONS[name] || Info;
  return (
    <Cmp
      size={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      style={{ verticalAlign: '-0.18em', flexShrink: 0, ...style }}
      {...rest}
    />
  );
}
