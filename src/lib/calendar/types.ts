export type FamilyEvent = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  birthdayAge?: number;
  location?: string;
  note?: string;
};

export type FamilyAgenda = {
  events: FamilyEvent[];
  updatedAt: string;
  startDate: string;
  endDate: string;
};
