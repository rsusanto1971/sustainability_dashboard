import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Overview from './pages/Overview.jsx';
import Waste from './pages/Waste.jsx';
import Utilities from './pages/Utilities.jsx';
import Targets from './pages/Targets.jsx';
import EnterData from './pages/EnterData.jsx';
import { EmptyState } from './components/States.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="waste" element={<Waste />} />
        <Route path="utilities" element={<Utilities />} />
        <Route path="targets" element={<Targets />} />
        <Route path="enter" element={<EnterData />} />
        <Route path="*" element={<EmptyState title="Page not found" message="Use the menu above to pick a screen." />} />
      </Route>
    </Routes>
  );
}
