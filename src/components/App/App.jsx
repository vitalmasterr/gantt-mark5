import useApp from "./useApp.js";
import Gantt from "../Gantt/Gantt.jsx";

function App() {
    const {} = useApp();
    return (
        <div className="app">
            <Gantt/>
        </div>
    )
}

export default App
