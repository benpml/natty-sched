/**
 * Autocomplete Templates - Pre-defined common schedule patterns
 * Organized by category with popularity scores for ranking
 */

const { parseNaturalSchedule } = require('./parser');

/**
 * Template structure:
 * {
 *   label: string,              // Human-readable label
 *   input: string,              // The natural language input to parse
 *   category: string,           // Category for grouping
 *   keywords: string[],         // Keywords for matching
 *   popularity: number,         // 1-10, higher = more common
 *   description: string         // Optional description
 * }
 */

const DAILY_TEMPLATES = [
    { label: "Every day at 9:00 AM", input: "Every day at 9:00 AM", category: "Daily", keywords: ["every", "day", "daily", "morning"], popularity: 10 },
    { label: "Every day at 2:00 PM", input: "Every day at 2:00 PM", category: "Daily", keywords: ["every", "day", "daily", "afternoon"], popularity: 8 },
    { label: "Every day at 5:00 PM", input: "Every day at 5:00 PM", category: "Daily", keywords: ["every", "day", "daily", "evening"], popularity: 8 },
    { label: "Every day at midnight", input: "Every day at midnight", category: "Daily", keywords: ["every", "day", "daily", "midnight"], popularity: 6 },
    { label: "Every day at noon", input: "Every day at noon", category: "Daily", keywords: ["every", "day", "daily", "noon", "12pm"], popularity: 7 },
    { label: "Weekdays at 9:00 AM", input: "Weekdays at 9:00 AM", category: "Daily", keywords: ["weekdays", "business", "mon-fri", "morning"], popularity: 10 },
    { label: "Weekdays at 6:00 PM", input: "Weekdays at 6:00 PM", category: "Daily", keywords: ["weekdays", "business", "mon-fri", "evening"], popularity: 8 },
    { label: "Weekends at 10:00 AM", input: "Weekends at 10:00 AM", category: "Daily", keywords: ["weekends", "saturday", "sunday"], popularity: 7 },
    { label: "Every 2 days at 9:00 AM", input: "Every 2 days at 9:00 AM", category: "Daily", keywords: ["every", "2", "days", "other"], popularity: 6 },
    { label: "Every 3 days at 9:00 AM", input: "Every 3 days at 9:00 AM", category: "Daily", keywords: ["every", "3", "days"], popularity: 5 },
    { label: "Every other day at 9:00 AM", input: "Every other day at 9:00 AM", category: "Daily", keywords: ["every", "other", "day", "alternate"], popularity: 7 },
    { label: "Business days at 9:00 AM", input: "Business days at 9:00 AM", category: "Daily", keywords: ["business", "weekdays", "work"], popularity: 9 },
    { label: "Every weekday at 8:00 AM", input: "Every weekday at 8:00 AM", category: "Daily", keywords: ["weekday", "morning", "early"], popularity: 8 },
    { label: "Every weekend at 9:00 AM", input: "Every weekend at 9:00 AM", category: "Daily", keywords: ["weekend", "saturday", "sunday"], popularity: 6 },
    { label: "Daily at 6:00 AM", input: "Daily at 6:00 AM", category: "Daily", keywords: ["daily", "early", "morning"], popularity: 5 }
];

const WEEKLY_TEMPLATES = [
    { label: "Every Monday at 9:00 AM", input: "Every Monday at 9:00 AM", category: "Weekly", keywords: ["every", "monday", "mon", "weekly"], popularity: 9 },
    { label: "Every Monday at 2:00 PM", input: "Every Monday at 2:00 PM", category: "Weekly", keywords: ["every", "monday", "mon", "afternoon"], popularity: 7 },
    { label: "Every Tuesday at 10:00 AM", input: "Every Tuesday at 10:00 AM", category: "Weekly", keywords: ["every", "tuesday", "tue"], popularity: 8 },
    { label: "Every Wednesday at 2:00 PM", input: "Every Wednesday at 2:00 PM", category: "Weekly", keywords: ["every", "wednesday", "wed"], popularity: 8 },
    { label: "Every Thursday at 3:00 PM", input: "Every Thursday at 3:00 PM", category: "Weekly", keywords: ["every", "thursday", "thu", "thurs"], popularity: 7 },
    { label: "Every Friday at 5:00 PM", input: "Every Friday at 5:00 PM", category: "Weekly", keywords: ["every", "friday", "fri", "end"], popularity: 9 },
    { label: "Every Saturday at 10:00 AM", input: "Every Saturday at 10:00 AM", category: "Weekly", keywords: ["every", "saturday", "sat", "weekend"], popularity: 7 },
    { label: "Every Sunday at 10:00 AM", input: "Every Sunday at 10:00 AM", category: "Weekly", keywords: ["every", "sunday", "sun", "weekend"], popularity: 7 },
    { label: "Mondays and Wednesdays at 9:00 AM", input: "Mondays and Wednesdays at 9:00 AM", category: "Weekly", keywords: ["monday", "wednesday", "multiple"], popularity: 8 },
    { label: "Mondays and Fridays at 10:00 AM", input: "Mondays and Fridays at 10:00 AM", category: "Weekly", keywords: ["monday", "friday", "multiple"], popularity: 8 },
    { label: "Tuesdays and Thursdays at 2:00 PM", input: "Tuesdays and Thursdays at 2:00 PM", category: "Weekly", keywords: ["tuesday", "thursday", "multiple"], popularity: 8 },
    { label: "Every Monday, Wednesday and Friday at 9:00 AM", input: "Monday, Wednesday and Friday at 9:00 AM", category: "Weekly", keywords: ["monday", "wednesday", "friday", "mwf"], popularity: 7 },
    { label: "Weekdays except Friday at 9:00 AM", input: "Weekdays except Friday at 9:00 AM", category: "Weekly", keywords: ["weekdays", "except", "not", "friday"], popularity: 6 },
    { label: "Weekends at 11:00 AM", input: "Weekends at 11:00 AM", category: "Weekly", keywords: ["weekends", "saturday", "sunday"], popularity: 6 },
    { label: "Every other Monday at 10:00 AM", input: "Every other Monday at 10:00 AM", category: "Weekly", keywords: ["every", "other", "monday", "biweekly"], popularity: 6 },
    { label: "Every other week on Monday at 9:00 AM", input: "Every other week on Monday at 9:00 AM", category: "Weekly", keywords: ["every", "other", "week", "biweekly"], popularity: 6 },
    { label: "Every 2 weeks on Friday at 3:00 PM", input: "Every 2 weeks on Friday at 3:00 PM", category: "Weekly", keywords: ["every", "2", "weeks", "biweekly", "friday"], popularity: 5 },
    { label: "Weekly on Tuesday at 1:00 PM", input: "Weekly on Tuesday at 1:00 PM", category: "Weekly", keywords: ["weekly", "tuesday"], popularity: 7 },
    { label: "Mon/Wed/Fri at 8:00 AM", input: "Mon/Wed/Fri at 8:00 AM", category: "Weekly", keywords: ["monday", "wednesday", "friday", "mwf"], popularity: 7 },
    { label: "Tuesday + Thursday at 10:30 AM", input: "Tuesday + Thursday at 10:30 AM", category: "Weekly", keywords: ["tuesday", "thursday", "multiple"], popularity: 6 }
];

const MONTHLY_TEMPLATES = [
    { label: "Monthly on the 1st at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["monthly", "1st", "first", "beginning"], popularity: 10 },
    { label: "Monthly on the 15th at noon", input: "Monthly on the 15th at noon", category: "Monthly", keywords: ["monthly", "15th", "fifteenth", "middle"], popularity: 9 },
    { label: "On the 1st and 15th at 9:00 AM", input: "On the 1st and 15th at 9:00 AM", category: "Monthly", keywords: ["1st", "15th", "twice", "bimonthly"], popularity: 8 },
    { label: "Monthly on the last day at 5:00 PM", input: "Monthly on the last day at 5:00 PM", category: "Monthly", keywords: ["monthly", "last", "end"], popularity: 9 },
    { label: "Every month on the 5th at 10:00 AM", input: "Every month on the 5th at 10:00 AM", category: "Monthly", keywords: ["every", "month", "5th"], popularity: 7 },
    { label: "Every month on the 10th at 2:00 PM", input: "Every month on the 10th at 2:00 PM", category: "Monthly", keywords: ["every", "month", "10th"], popularity: 6 },
    { label: "On the 20th of each month at 3:00 PM", input: "On the 20th of each month at 3:00 PM", category: "Monthly", keywords: ["20th", "each", "month"], popularity: 6 },
    { label: "Monthly on the 25th at 9:00 AM", input: "Monthly on the 25th at 9:00 AM", category: "Monthly", keywords: ["monthly", "25th"], popularity: 5 },
    { label: "First Monday of the month at 9:00 AM", input: "First Monday of the month at 9:00 AM", category: "Monthly", keywords: ["first", "monday", "month"], popularity: 8 },
    { label: "Last Friday of the month at 5:00 PM", input: "Last Friday of the month at 5:00 PM", category: "Monthly", keywords: ["last", "friday", "month", "end"], popularity: 9 },
    { label: "First Wednesday of every month at 10:00 AM", input: "First Wednesday of every month at 10:00 AM", category: "Monthly", keywords: ["first", "wednesday", "month"], popularity: 7 },
    { label: "Second Tuesday of the month at 2:00 PM", input: "Second Tuesday of the month at 2:00 PM", category: "Monthly", keywords: ["second", "tuesday", "month"], popularity: 6 },
    { label: "Third Thursday of every month at 1:00 PM", input: "Third Thursday of every month at 1:00 PM", category: "Monthly", keywords: ["third", "thursday", "month"], popularity: 5 },
    { label: "Last day of each month at midnight", input: "Last day of each month at midnight", category: "Monthly", keywords: ["last", "day", "month", "midnight"], popularity: 6 },
    { label: "Monthly on the 31st when it exists", input: "Monthly on the 31st when it exists", category: "Monthly", keywords: ["monthly", "31st", "when", "exists"], popularity: 4 },
    { label: "Every 2 months on the 1st at 9:00 AM", input: "Every 2 months on the 1st at 9:00 AM", category: "Monthly", keywords: ["every", "2", "months", "bimonthly"], popularity: 6 },
    { label: "Every 3 months on the 1st at 9:00 AM", input: "Every 3 months on the 1st at 9:00 AM", category: "Monthly", keywords: ["every", "3", "months", "quarterly"], popularity: 7 },
    { label: "Every 6 months on the 1st at 10:00 AM", input: "Every 6 months on the 1st at 10:00 AM", category: "Monthly", keywords: ["every", "6", "months", "biannual"], popularity: 5 },
    { label: "On the 1st, 10th, and 20th at 9:00 AM", input: "On the 1st, 10th, and 20th at 9:00 AM", category: "Monthly", keywords: ["1st", "10th", "20th", "multiple"], popularity: 4 },
    { label: "Monthly on day one at 8:00 AM", input: "Monthly on day one at 8:00 AM", category: "Monthly", keywords: ["monthly", "day", "one", "first"], popularity: 6 }
];

const QUARTERLY_TEMPLATES = [
    { label: "Quarterly on the 1st at 9:00 AM", input: "Quarterly on the 1st at 9:00 AM", category: "Quarterly", keywords: ["quarterly", "quarter", "1st"], popularity: 9 },
    { label: "Every quarter on the 1st at 10:00 AM", input: "Every quarter on the 1st at 10:00 AM", category: "Quarterly", keywords: ["every", "quarter", "quarterly"], popularity: 8 },
    { label: "Quarterly at midnight", input: "Quarterly at midnight", category: "Quarterly", keywords: ["quarterly", "quarter", "midnight"], popularity: 5 },
    { label: "Every 3 months on the 15th at noon", input: "Every 3 months on the 15th at noon", category: "Quarterly", keywords: ["every", "3", "months", "quarterly", "15th"], popularity: 7 },
    { label: "Every quarter on day one at 9:00 AM", input: "Every quarter on day one at 9:00 AM", category: "Quarterly", keywords: ["every", "quarter", "day", "one"], popularity: 6 }
];

const YEARLY_TEMPLATES = [
    { label: "Annually on January 1st at 9:00 AM", input: "Annually on January 1st at 9:00 AM", category: "Yearly", keywords: ["annually", "yearly", "january", "1st", "new year"], popularity: 8 },
    { label: "Every year on March 1st at 9:00 AM", input: "Every year on March 1st at 9:00 AM", category: "Yearly", keywords: ["every", "year", "yearly", "march"], popularity: 7 },
    { label: "Every year on December 31st at 11:59 PM", input: "Every year on December 31st at 11:59 PM", category: "Yearly", keywords: ["every", "year", "december", "31st", "end"], popularity: 7 },
    { label: "Annually on June 15th at 10:00 AM", input: "Annually on June 15th at 10:00 AM", category: "Yearly", keywords: ["annually", "june", "15th"], popularity: 5 },
    { label: "Yearly on September 1st at 9:00 AM", input: "Yearly on September 1st at 9:00 AM", category: "Yearly", keywords: ["yearly", "september", "1st"], popularity: 5 },
    { label: "Every year on the last day of February", input: "Every year on the last day of February", category: "Yearly", keywords: ["every", "year", "last", "february"], popularity: 4 },
    { label: "Annually on April 1st at noon", input: "Annually on April 1st at noon", category: "Yearly", keywords: ["annually", "april", "1st"], popularity: 4 },
    { label: "Every year on July 4th at 10:00 AM", input: "Every year on July 4th at 10:00 AM", category: "Yearly", keywords: ["every", "year", "july", "4th"], popularity: 4 },
    { label: "Yearly on October 31st at midnight", input: "Yearly on October 31st at midnight", category: "Yearly", keywords: ["yearly", "october", "31st", "halloween"], popularity: 4 },
    { label: "Annually on December 25th at 9:00 AM", input: "Annually on December 25th at 9:00 AM", category: "Yearly", keywords: ["annually", "december", "25th", "christmas"], popularity: 5 }
];

const ONETIME_TEMPLATES = [
    { label: "Tomorrow at 9:00 AM", input: "Tomorrow at 9:00 AM", category: "One-time", keywords: ["tomorrow", "next", "day"], popularity: 10 },
    { label: "Tomorrow at 2:00 PM", input: "Tomorrow at 2:00 PM", category: "One-time", keywords: ["tomorrow", "afternoon"], popularity: 8 },
    { label: "Today at 5:00 PM", input: "Tomorrow at 5:00 PM", category: "One-time", keywords: ["today", "later"], popularity: 9 },
    { label: "Today at 3:00 PM", input: "Tomorrow at 3:00 PM", category: "One-time", keywords: ["today"], popularity: 8 },
    { label: "Next Monday at 9:00 AM", input: "Next Monday at 9:00 AM", category: "One-time", keywords: ["next", "monday"], popularity: 9 },
    { label: "Next Tuesday at 10:00 AM", input: "Next Tuesday at 10:00 AM", category: "One-time", keywords: ["next", "tuesday"], popularity: 8 },
    { label: "Next Tuesday at 3:00 PM", input: "Next Tuesday at 3:00 PM", category: "One-time", keywords: ["next", "tuesday"], popularity: 7 },
    { label: "Next Friday at 5:00 PM", input: "Next Friday at 5:00 PM", category: "One-time", keywords: ["next", "friday", "end"], popularity: 8 },
    { label: "In a week at 9:00 AM", input: "In 7 days at 9:00 AM", category: "One-time", keywords: ["in", "week", "a"], popularity: 8 },
    { label: "In 5 days at 9:00 AM", input: "In 5 days at 9:00 AM", category: "One-time", keywords: ["in", "5", "days"], popularity: 7 },
    { label: "In 7 days at 9:00 AM", input: "In 7 days at 9:00 AM", category: "One-time", keywords: ["in", "7", "days", "week"], popularity: 7 },
    { label: "In 30 days at 10:00 AM", input: "In 30 days at 10:00 AM", category: "One-time", keywords: ["in", "30", "days", "month"], popularity: 6 },
    { label: "In an hour", input: "In 1 hour", category: "One-time", keywords: ["in", "an", "hour"], popularity: 7 },
    { label: "3 days from now at 2:00 PM", input: "3 days from now at 2:00 PM", category: "One-time", keywords: ["3", "days", "from", "now"], popularity: 7 },
    { label: "3 weeks from now at 9:00 AM", input: "In 21 days at 9:00 AM", category: "One-time", keywords: ["3", "weeks", "from", "now"], popularity: 6 },
    { label: "Two Fridays from now at 5:00 PM", input: "In 2 fridays at 5:00 PM", category: "One-time", keywords: ["two", "fridays", "from"], popularity: 5 },
    { label: "5 fridays from now at 3:00 PM", input: "5 fridays from now at 3:00 PM", category: "One-time", keywords: ["5", "fridays", "from", "now"], popularity: 4 },
    { label: "Next week at 9:00 AM", input: "Next week at 9:00 AM", category: "One-time", keywords: ["next", "week"], popularity: 7 },
    { label: "Next month at midnight", input: "Next month at midnight", category: "One-time", keywords: ["next", "month"], popularity: 5 },
    { label: "Next quarter at 9:00 AM", input: "Next quarter at 9:00 AM", category: "One-time", keywords: ["next", "quarter"], popularity: 4 },
    { label: "End of the year at midnight", input: "End of the year at midnight", category: "One-time", keywords: ["end", "year"], popularity: 4 },
    { label: "End of the month at 5:00 PM", input: "Last day of each month at 5:00 PM", category: "Monthly", keywords: ["end", "month"], popularity: 7 },
    { label: "Start of the week at 9:00 AM", input: "Every Monday at 9:00 AM", category: "Weekly", keywords: ["start", "week"], popularity: 6 },
    { label: "Later today at 4:00 PM", input: "Later today at 4:00 PM", category: "One-time", keywords: ["later", "today"], popularity: 6 },
    { label: "This Friday at 6:00 PM", input: "This Friday at 6:00 PM", category: "One-time", keywords: ["this", "friday"], popularity: 7 }
];

const ADVANCED_TEMPLATES = [
    { label: "Every 15 minutes", input: "Every 15 minutes", category: "Advanced", keywords: ["every", "15", "minutes", "frequent"], popularity: 8 },
    { label: "Every 30 minutes", input: "Every 30 minutes", category: "Advanced", keywords: ["every", "30", "minutes", "half", "hour"], popularity: 7 },
    { label: "Every hour at :30", input: "Every hour at :30", category: "Advanced", keywords: ["every", "hour", "30", "half"], popularity: 6 },
    { label: "Every 2 hours at 9:00 AM", input: "Every 2 hours at 9:00 AM", category: "Advanced", keywords: ["every", "2", "hours"], popularity: 6 },
    { label: "Every 4 hours", input: "Every 4 hours", category: "Advanced", keywords: ["every", "4", "hours"], popularity: 5 },
    { label: "Every 6 hours", input: "Every 6 hours", category: "Advanced", keywords: ["every", "6", "hours"], popularity: 5 },
    { label: "Hourly on the half hour", input: "Hourly on the half hour", category: "Advanced", keywords: ["hourly", "half", "30"], popularity: 4 },
    { label: "Every weekday except Monday at 9:00 AM", input: "Every weekday except Monday at 9:00 AM", category: "Advanced", keywords: ["weekday", "except", "monday", "not"], popularity: 5 },
    { label: "Weekends but not Sundays at 10:00 AM", input: "Weekends but not Sundays at 10:00 AM", category: "Advanced", keywords: ["weekends", "but", "not", "sunday"], popularity: 4 },
    { label: "Every 10 days at 9:00 AM", input: "Every 10 days at 9:00 AM", category: "Advanced", keywords: ["every", "10", "days"], popularity: 4 },
    { label: "Every 14 days at 2:00 PM", input: "Every 14 days at 2:00 PM", category: "Advanced", keywords: ["every", "14", "days", "two weeks"], popularity: 4 },
    { label: "Every 45 days at 9:00 AM", input: "Every 45 days at 9:00 AM", category: "Advanced", keywords: ["every", "45", "days"], popularity: 3 },
    { label: "Weekdays minus Friday at 9:00 AM", input: "Weekdays minus Friday at 9:00 AM", category: "Advanced", keywords: ["weekdays", "minus", "friday", "except"], popularity: 4 },
    { label: "Every 5 days at noon", input: "Every 5 days at noon", category: "Advanced", keywords: ["every", "5", "days"], popularity: 4 },
    { label: "Every 21 days at 10:00 AM", input: "Every 21 days at 10:00 AM", category: "Advanced", keywords: ["every", "21", "days"], popularity: 3 }
];

// Time-first patterns - when users start with time
const TIMEFIRST_TEMPLATES = [
    { label: "At 9:00 AM every day", input: "At 9:00 AM every day", category: "Time-first", keywords: ["at", "9", "9am", "morning"], popularity: 9 },
    { label: "At 2:00 PM every weekday", input: "At 2:00 PM every weekday", category: "Time-first", keywords: ["at", "2", "2pm", "afternoon"], popularity: 8 },
    { label: "At 5:00 PM on Fridays", input: "At 5:00 PM on Fridays", category: "Time-first", keywords: ["at", "5", "5pm", "friday"], popularity: 8 },
    { label: "At 10:00 AM on Mondays", input: "At 10:00 AM on Mondays", category: "Time-first", keywords: ["at", "10", "10am", "monday"], popularity: 7 },
    { label: "At noon every day", input: "At noon every day", category: "Time-first", keywords: ["at", "noon", "12pm"], popularity: 7 },
    { label: "At midnight every day", input: "At midnight every day", category: "Time-first", keywords: ["at", "midnight", "12am"], popularity: 6 },
    { label: "9:00 AM every day", input: "Every day at 9:00 AM", category: "Time-first", keywords: ["9", "9am", "9:00"], popularity: 8 },
    { label: "9am every day", input: "Every day at 9:00 AM", category: "Time-first", keywords: ["9am"], popularity: 9 },
    { label: "2pm every day", input: "Every day at 2:00 PM", category: "Time-first", keywords: ["2pm"], popularity: 8 },
    { label: "5pm every Friday", input: "Every Friday at 5:00 PM", category: "Time-first", keywords: ["5pm"], popularity: 8 },
    { label: "Morning every day", input: "Every day at 9:00 AM", category: "Time-first", keywords: ["morning", "early"], popularity: 9 },
    { label: "Afternoon every day", input: "Every day at 2:00 PM", category: "Time-first", keywords: ["afternoon"], popularity: 8 },
    { label: "Evening every day", input: "Every day at 6:00 PM", category: "Time-first", keywords: ["evening"], popularity: 8 },
    { label: "Early morning every weekday", input: "Every weekday at 7:00 AM", category: "Time-first", keywords: ["early", "morning"], popularity: 7 },
    { label: "09:00 every day", input: "Every day at 9:00 AM", category: "Time-first", keywords: ["09:00", "09"], popularity: 6 }
];

// Natural language alternatives
const ALTERNATIVE_TEMPLATES = [
    { label: "Each day at 9:00 AM", input: "Every day at 9:00 AM", category: "Daily", keywords: ["each", "day"], popularity: 9 },
    { label: "All days at 9:00 AM", input: "Every day at 9:00 AM", category: "Daily", keywords: ["all", "days"], popularity: 9 },
    { label: "Once a day at 9:00 AM", input: "Every day at 9:00 AM", category: "Daily", keywords: ["once", "day", "per"], popularity: 8 },
    { label: "Once per day at 9:00 AM", input: "Every day at 9:00 AM", category: "Daily", keywords: ["once", "per", "day"], popularity: 7 },
    { label: "Twice a day at 9:00 AM and 5:00 PM", input: "Every day at 9:00 AM", category: "Daily", keywords: ["twice", "day"], popularity: 7 },
    { label: "Once a week on Monday at 9:00 AM", input: "Every Monday at 9:00 AM", category: "Weekly", keywords: ["once", "week", "per"], popularity: 8 },
    { label: "Twice a week on Monday and Friday at 9:00 AM", input: "Mondays and Fridays at 9:00 AM", category: "Weekly", keywords: ["twice", "week"], popularity: 7 },
    { label: "Once a month on the 1st at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["once", "month", "per"], popularity: 8 },
    { label: "Each Monday at 9:00 AM", input: "Every Monday at 9:00 AM", category: "Weekly", keywords: ["each", "monday"], popularity: 8 },
    { label: "Each week on Monday at 9:00 AM", input: "Every week on Monday at 9:00 AM", category: "Weekly", keywords: ["each", "week"], popularity: 7 },
    { label: "All Mondays at 9:00 AM", input: "Every Monday at 9:00 AM", category: "Weekly", keywords: ["all", "mondays"], popularity: 9 },
    { label: "All Tuesdays at 10:00 AM", input: "Every Tuesday at 10:00 AM", category: "Weekly", keywords: ["all", "tuesdays"], popularity: 8 },
    { label: "All Wednesdays at 2:00 PM", input: "Every Wednesday at 2:00 PM", category: "Weekly", keywords: ["all", "wednesdays"], popularity: 8 },
    { label: "All Thursdays at 3:00 PM", input: "Every Thursday at 3:00 PM", category: "Weekly", keywords: ["all", "thursdays"], popularity: 8 },
    { label: "All Fridays at 5:00 PM", input: "Every Friday at 5:00 PM", category: "Weekly", keywords: ["all", "fridays"], popularity: 9 }
];

// Date and month patterns
const DATE_TEMPLATES = [
    { label: "January 1st at 9:00 AM", input: "Every year on January 1st at 9:00 AM", category: "Yearly", keywords: ["january", "jan", "1st"], popularity: 7 },
    { label: "January 15th at 10:00 AM", input: "Every year on January 15th at 10:00 AM", category: "Yearly", keywords: ["january", "jan", "15"], popularity: 6 },
    { label: "February 1st at 9:00 AM", input: "Every year on February 1st at 9:00 AM", category: "Yearly", keywords: ["february", "feb", "1st"], popularity: 6 },
    { label: "March 1st at 9:00 AM", input: "Every year on March 1st at 9:00 AM", category: "Yearly", keywords: ["march", "mar", "1st"], popularity: 6 },
    { label: "The 1st of each month at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["the", "1st", "each"], popularity: 9 },
    { label: "The 15th of each month at noon", input: "Monthly on the 15th at noon", category: "Monthly", keywords: ["the", "15th", "each"], popularity: 8 },
    { label: "On the 15th at 9:00 AM", input: "Monthly on the 15th at 9:00 AM", category: "Monthly", keywords: ["on", "15th"], popularity: 8 },
    { label: "On the 1st at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["on", "1st"], popularity: 8 },
    { label: "On the last day at 5:00 PM", input: "Monthly on the last day at 5:00 PM", category: "Monthly", keywords: ["on", "last", "day"], popularity: 7 },
    { label: "On the first at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["on", "first"], popularity: 7 },
    { label: "1st of each month at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["1st", "of", "each"], popularity: 8 },
    { label: "15th of each month at noon", input: "Monthly on the 15th at noon", category: "Monthly", keywords: ["15th", "of", "each"], popularity: 7 },
    { label: "1st at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["1st"], popularity: 7 },
    { label: "Day 1 of each month at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["day", "1", "month"], popularity: 6 }
];

// Frequency and position patterns
const FREQUENCY_TEMPLATES = [
    { label: "Once a day at 9:00 AM", input: "Every day at 9:00 AM", category: "Daily", keywords: ["once", "a", "day"], popularity: 8 },
    { label: "Once a week on Monday at 9:00 AM", input: "Every Monday at 9:00 AM", category: "Weekly", keywords: ["once", "a", "week"], popularity: 8 },
    { label: "Once a month on the 1st at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["once", "a", "month"], popularity: 7 },
    { label: "Twice a day at 9:00 AM and 5:00 PM", input: "Every day at 9:00 AM", category: "Daily", keywords: ["twice", "a", "day"], popularity: 7 },
    { label: "Twice a week on Monday and Friday at 9:00 AM", input: "Mondays and Fridays at 9:00 AM", category: "Weekly", keywords: ["twice", "a", "week"], popularity: 7 },
    { label: "At the beginning of each month at 9:00 AM", input: "Monthly on the 1st at 9:00 AM", category: "Monthly", keywords: ["at", "beginning", "each", "month"], popularity: 7 },
    { label: "At the end of each month at 5:00 PM", input: "Monthly on the last day at 5:00 PM", category: "Monthly", keywords: ["at", "end", "each", "month"], popularity: 7 },
    { label: "At the end of each quarter at 5:00 PM", input: "Quarterly on the 1st at 5:00 PM", category: "Quarterly", keywords: ["at", "end", "quarter"], popularity: 5 },
    { label: "At the beginning of each week at 9:00 AM", input: "Every Monday at 9:00 AM", category: "Weekly", keywords: ["at", "beginning", "week"], popularity: 6 }
];

// Combine all templates
const ALL_TEMPLATES = [
    ...DAILY_TEMPLATES,
    ...WEEKLY_TEMPLATES,
    ...MONTHLY_TEMPLATES,
    ...QUARTERLY_TEMPLATES,
    ...YEARLY_TEMPLATES,
    ...ONETIME_TEMPLATES,
    ...ADVANCED_TEMPLATES,
    ...TIMEFIRST_TEMPLATES,
    ...ALTERNATIVE_TEMPLATES,
    ...DATE_TEMPLATES,
    ...FREQUENCY_TEMPLATES
];

/**
 * Get all templates
 */
function getAllTemplates() {
    return ALL_TEMPLATES.map(template => ({
        ...template,
        value: null // Will be populated on demand
    }));
}

/**
 * Get templates by category
 */
function getTemplatesByCategory(category) {
    return ALL_TEMPLATES.filter(t => t.category === category);
}

/**
 * Get all categories
 */
function getCategories() {
    return ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly', 'One-time', 'Advanced'];
}

/**
 * Parse template and add value
 */
function parseTemplate(template) {
    try {
        const value = parseNaturalSchedule(template.input);
        return {
            ...template,
            value
        };
    } catch (error) {
        return {
            ...template,
            value: null,
            parseError: error.message
        };
    }
}

module.exports = {
    ALL_TEMPLATES,
    DAILY_TEMPLATES,
    WEEKLY_TEMPLATES,
    MONTHLY_TEMPLATES,
    QUARTERLY_TEMPLATES,
    YEARLY_TEMPLATES,
    ONETIME_TEMPLATES,
    ADVANCED_TEMPLATES,
    TIMEFIRST_TEMPLATES,
    ALTERNATIVE_TEMPLATES,
    DATE_TEMPLATES,
    FREQUENCY_TEMPLATES,
    getAllTemplates,
    getTemplatesByCategory,
    getCategories,
    parseTemplate
};
