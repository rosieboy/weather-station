export type FamilyEvent = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
};

export type FamilyAgenda = {
  events: FamilyEvent[];
  updatedAt: string;
  startDate: string;
  endDate: string;
};
