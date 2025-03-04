// Timesheets.jsx
import { useCallback, useEffect, useState } from "react";
import Timesheet from "../models/Timesheet";
import { getTimesheets } from "../apis/timesheetAPI";
import { useNavigate } from "react-router-dom";
import { isToday } from "date-fns";

const getDayOfWeek = (dateString: string) => {
  const date = new Date(dateString);
  return date.getDay();
};

function Timesheets() {
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const navigate = useNavigate();

  const getCurrentWeek = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDays = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDays + firstDayOfYear.getDay() + 1) / 7);
  };

  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek(new Date()));

  const updateCurrentWeek = useCallback(() => {
    const today = new Date();
    const currentYearDate = new Date(currentYear, today.getMonth(), today.getDate());
    setCurrentWeek(getCurrentWeek(currentYearDate));
  }, [currentYear]);

  useEffect(() => {
    fetchTimesheets();
    updateCurrentWeek();
  }, [currentYear, updateCurrentWeek]);

  const fetchTimesheets = async () => {
    const data = await getTimesheets();
    if (data) {
      setTimesheets(data);
    }
  };

  const generateWeeks = () => {
    return Array.from({ length: 52 }, (_, i) => i + 1).map(weekNumber => ({
      weekNumber,
      year: currentYear,
      visits: timesheets
        .filter(ts => Number(ts.weekNumber) === weekNumber && Number(ts.year) === currentYear)
        .flatMap(ts => ts.Visits)
    }));
  };

  const getWeekDates = (year: number, weekNumber: number) => {
    const firstDay = new Date(year, 0, 1);
    const daysOffset = (firstDay.getDay() + 6) % 7;
    const firstMonday = new Date(firstDay);
    firstMonday.setDate(firstMonday.getDate() - daysOffset + 1);
    
    const startDate = new Date(firstMonday);
    startDate.setDate(startDate.getDate() + (weekNumber - 1) * 7);
    
    return Array.from({ length: 5 }, (_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      return date;
    });
  };

  const handleCurrentWeekClick = () => {
    const today = new Date();
    setCurrentYear(today.getFullYear());
    setTimeout(() => {
      const element = document.getElementById(`week-${currentWeek}`);
      if (element) element.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  };

  return (
    <div className="container">
      <div className="header-controls">
        <div className="year-navigation">
          <button onClick={() => setCurrentYear(y => y - 1)}>←</button>
          <h1>{currentYear}</h1>
          <button onClick={() => setCurrentYear(y => y + 1)}>→</button>
        </div>
        
        <div className="view-toggle">
          <button 
            className={viewMode === 'week' ? 'active' : ''}
            onClick={() => setViewMode('week')}
          >
            Week View
          </button>
          <button 
            className={viewMode === 'day' ? 'active' : ''}
            onClick={() => setViewMode('day')}
          >
            Day View
          </button>
        </div>
        
        <div className="action-buttons">
          <button 
            className="primary-button"
            onClick={() => navigate('/visitForm', {
              state: { weekNumber: currentWeek, year: currentYear }
            })}
          >
            Create Visit
          </button>
          <button 
            className="secondary-button"
            onClick={handleCurrentWeekClick}
          >
            Current Week/Day
          </button>
        </div>
      </div>

      {viewMode === 'week' && (
        <div className="week-scroller">
          {generateWeeks().map(week => (
            <div className="week-card" key={week.weekNumber} id={`week-${week.weekNumber}`}>
              <div className="week-header">
                <div className="week-number">Week {week.weekNumber}</div>
              </div>
              <div className="days-container">
                {["Mon", "Tue", "Wed", "Thu", "Fri"].map(day => (
                  <div className="day-box" key={day}>
                    <div className="day-label">{day}</div>
                    {week.visits
                      .filter(visit => getDayOfWeek(visit.date) === (day === "Mon" ? 1 : 
                                                                    day === "Tue" ? 2 : 
                                                                    day === "Wed" ? 3 : 
                                                                    day === "Thu" ? 4 : 5))
                      .map(visit => (
                        <div 
                          className="visit-item" 
                          key={visit.visitID}
                          onClick={() => navigate(`/visit/${visit.visitID}`)}
                        >
                          <div className="visit-time">{visit.time}</div>
                          <div className="visit-location">{visit.location}</div>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewMode === 'day' && (
        <div className="day-scroller">
          {getWeekDates(currentYear, currentWeek).map(date => (
            <div 
              className={`day-card ${isToday(date) ? 'today' : ''}`} 
              key={date.toISOString()}
              id={`day-${date.toISOString().split('T')[0]}`}
            >
              <div className="day-header">
                <div className="day-date">{date.toLocaleDateString('en-GB', { 
                  weekday: 'short', 
                  day: 'numeric', 
                  month: 'short' 
                })}</div>
              </div>
              <div className="visits-container">
                {timesheets
                  .flatMap(ts => ts.Visits)
                  .filter(visit => visit.date === date.toISOString().split('T')[0])
                  .map(visit => (
                    <div 
                      className="visit-item" 
                      key={visit.visitID}
                      onClick={() => navigate(`/visit/${visit.visitID}`)}
                    >
                      <div className="visit-time">{visit.time}</div>
                      <div className="visit-location">{visit.location}</div>
                    </div>
                  ))}
                {timesheets
                  .flatMap(ts => ts.Visits)
                  .filter(visit => visit.date === date.toISOString().split('T')[0])
                  .length === 0 && <div className="no-visits">No visits</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Timesheets;