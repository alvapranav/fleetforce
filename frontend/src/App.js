import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { Main, Drilldown } from './pages';
import './App.css';

const App = () => {
  return (
    <div className="app-container">
      <div className="main-content">
      <Routes>
        <Route index element={<Main />} />
        <Route path='/explore/:tractorId/:arrivalDate/:toArrivalDate' element={<Drilldown />} />
      </Routes>
      </div>
    </div>
  );
}

export default App;
