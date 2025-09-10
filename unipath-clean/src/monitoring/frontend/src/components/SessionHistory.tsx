import React, { useEffect, useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import {
  CheckCircle,
  Error,
  PlayArrow,
  Visibility,
} from '@mui/icons-material';
import axios from 'axios';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const SessionHistory: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/sessions');
      setSessions(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setLoading(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => {
        const icons: any = {
          active: <PlayArrow color="primary" />,
          completed: <CheckCircle color="success" />,
          crashed: <Error color="error" />,
        };
        return (
          <Tooltip title={params.value}>
            {icons[params.value] || params.value}
          </Tooltip>
        );
      },
    },
    {
      field: 'id',
      headerName: 'Session ID',
      width: 150,
      renderCell: (params) => (
        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
          {params.value.substring(0, 8)}...
        </Typography>
      ),
    },
    {
      field: 'projectName',
      headerName: 'Project',
      width: 150,
      valueGetter: (params) => params.row.project?.name || 'Unknown',
    },
    {
      field: 'mode',
      headerName: 'Mode',
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="primary" />
      ),
    },
    {
      field: 'startedAt',
      headerName: 'Started',
      width: 150,
      valueGetter: (params) => dayjs(params.value).fromNow(),
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 120,
      valueGetter: (params) => {
        if (!params.row.endedAt) return 'Ongoing';
        const start = dayjs(params.row.startedAt);
        const end = dayjs(params.row.endedAt);
        const minutes = end.diff(start, 'minute');
        if (minutes < 60) return `${minutes}m`;
        return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
      },
    },
    {
      field: 'turnCount',
      headerName: 'Turns',
      width: 80,
      type: 'number',
    },
    {
      field: 'tokensUsed',
      headerName: 'Tokens',
      width: 100,
      type: 'number',
      valueFormatter: (params) => params.value?.toLocaleString() || '0',
    },
    {
      field: 'snapshots',
      headerName: 'Snapshots',
      width: 100,
      valueGetter: (params) => params.value?.length || 0,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      renderCell: (params) => (
        <Tooltip title="View Details">
          <IconButton size="small">
            <Visibility />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Paper sx={{ p: 2, height: '80vh' }}>
      <Typography variant="h6" gutterBottom>
        Session History
      </Typography>
      <DataGrid
        rows={sessions}
        columns={columns}
        loading={loading}
        pageSizeOptions={[10, 25, 50]}
        initialState={{
          pagination: {
            paginationModel: { pageSize: 10, page: 0 },
          },
        }}
        sx={{
          '& .MuiDataGrid-cell': {
            borderColor: '#334155',
          },
          '& .MuiDataGrid-columnHeaders': {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
          },
          '& .MuiDataGrid-footerContainer': {
            backgroundColor: '#1e293b',
            borderColor: '#334155',
          },
        }}
      />
    </Paper>
  );
};

export default SessionHistory;