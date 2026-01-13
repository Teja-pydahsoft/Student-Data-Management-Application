import React, { useEffect, useState } from 'react';
import transportService from '../../services/transportService';
import { toast } from 'react-hot-toast';
import { RiBusLine, RiMapPinLine, RiTicketLine, RiHistoryLine, RiCheckDoubleLine, RiTimeLine } from 'react-icons/ri';

const Transport = () => {
    const [routes, setRoutes] = useState([]);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedRoute, setSelectedRoute] = useState(null);
    const [selectedStage, setSelectedStage] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [routeRes, reqRes] = await Promise.all([
                transportService.getRoutes(),
                transportService.getMyRequests()
            ]);
            setRoutes(routeRes.data.data || []);
            setRequests(reqRes.data.data || []);
        } catch (error) {
            console.error(error);
            toast.error('Failed to load transport details');
        } finally {
            setLoading(false);
        }
    };

    const handleRouteSelect = (e) => {
        const routeId = e.target.value;
        const route = routes.find(r => r.routeId === routeId);
        setSelectedRoute(route);
        setSelectedStage(null); // Reset stage
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedRoute || !selectedStage) {
            toast.error('Please select a route and stage');
            return;
        }

        if (!window.confirm(`Confirm Request for Route: ${selectedRoute.routeName}, Stage: ${selectedStage.stageName}, Fare: ₹${selectedStage.fare}?`)) return;

        try {
            setSubmitting(true);
            await transportService.createRequest({
                route_id: selectedRoute.routeId,
                route_name: selectedRoute.routeName,
                stage_name: selectedStage.stageName,
                fare: selectedStage.fare,
                bus_id: null // Can be assigned later
            });
            toast.success('Transport request submitted successfully!');
            fetchData(); // Refresh history
            setSelectedRoute(null);
            setSelectedStage(null);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to submit request');
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800',
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800'
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${styles[status]}`}>
                {status}
            </span>
        );
    };

    return (
        <div className="p-6 space-y-8 animate-fade-in max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <RiBusLine className="text-blue-600" /> College Transport
                    </h1>
                    <p className="text-gray-500">View routes, fares and manage your transport subscription.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left: Request Form */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <RiTicketLine className="text-blue-500" /> New Transport Request
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Route Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Route</label>
                                <div className="relative">
                                    <select
                                        className="w-full p-3 pl-10 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                                        onChange={handleRouteSelect}
                                        value={selectedRoute?.routeId || ''}
                                        required
                                    >
                                        <option value="">-- Choose a Route --</option>
                                        {routes.map(r => (
                                            <option key={r.routeId} value={r.routeId}>
                                                {r.routeName} ({r.startPoint} - {r.endPoint})
                                            </option>
                                        ))}
                                    </select>
                                    <RiMapPinLine className="absolute left-3 top-3.5 text-gray-400" size={18} />
                                </div>
                            </div>

                            {/* Stage Selection */}
                            {selectedRoute && (
                                <div className="animate-fade-in-up">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">Select Boarding Point (Stage)</label>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto custom-scrollbar p-1">
                                        {selectedRoute.stages.map((stage, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setSelectedStage(stage)}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all flex justify-between items-center ${selectedStage?.stageName === stage.stageName
                                                        ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500 shadow-sm'
                                                        : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                                                    }`}
                                            >
                                                <div>
                                                    <p className="font-semibold text-gray-800">{stage.stageName}</p>
                                                    <p className="text-xs text-gray-500">{stage.distanceFromStart} km</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="block text-lg font-bold text-green-600">₹{stage.fare}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Summary & Action */}
                            {selectedRoute && selectedStage && (
                                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center animate-fade-in">
                                    <div>
                                        <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Total Annual Fare</p>
                                        <p className="text-2xl font-bold text-gray-900">₹{selectedStage.fare}</p>
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {submitting ? 'Submitting...' : 'Raise Request'}
                                    </button>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Route Details Card */}
                    {selectedRoute && (
                        <div className="bg-gradient-to-br from-gray-800 to-gray-900 text-white rounded-2xl shadow-lg p-6 animate-fade-in">
                            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <RiBusLine /> Route Details: {selectedRoute.routeName}
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                <div>
                                    <p className="text-gray-400 text-xs uppercase mb-1">Start Point</p>
                                    <p className="font-semibold">{selectedRoute.startPoint}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-xs uppercase mb-1">End Point</p>
                                    <p className="font-semibold">{selectedRoute.endPoint}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-xs uppercase mb-1">Est. Time</p>
                                    <p className="font-semibold flex items-center gap-1"><RiTimeLine /> {selectedRoute.estimatedTime || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400 text-xs uppercase mb-1">Total Distance</p>
                                    <p className="font-semibold">{selectedRoute.totalDistance} km</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: History */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-full">
                    <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <RiHistoryLine className="text-purple-500" /> Request History
                    </h2>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                        {loading ? (
                            <p className="text-center text-gray-400 py-10">Loading...</p>
                        ) : requests.length === 0 ? (
                            <div className="text-center py-10">
                                <div className="bg-gray-50 rounded-full h-16 w-16 flex items-center justify-center mx-auto mb-3 text-gray-300">
                                    <RiBusLine size={32} />
                                </div>
                                <p className="text-gray-500">No requests yet.</p>
                            </div>
                        ) : (
                            requests.map((req) => (
                                <div key={req.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100 hover:shadow-md transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="font-bold text-gray-800 line-clamp-1">{req.route_name}</h4>
                                        {getStatusBadge(req.status)}
                                    </div>
                                    <p className="text-sm text-gray-600 mb-1">Stage: <span className="font-medium">{req.stage_name}</span></p>
                                    <div className="flex justify-between items-center mt-3">
                                        <span className="text-xs text-gray-400">{new Date(req.request_date).toLocaleDateString()}</span>
                                        <span className="font-bold text-blue-600">₹{req.fare}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Transport;
