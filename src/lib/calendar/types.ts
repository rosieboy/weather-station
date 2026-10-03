export type FamilyEvent = {
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  birthdayAge?: number;
};

export type FamilyAgenda = {
  events: FamilyEvent[];
  updatedAt: string;
  startDate: string;
  endDate: string;
};
