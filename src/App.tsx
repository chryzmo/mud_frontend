import Ended from './screens/Ended';
import Game from './screens/Game';
import Landing from './screens/Landing';
import StaffLogin from './screens/StaffLogin';
import RecoveryCode from './screens/RecoveryCode';
import { getSession, isStaffRoute, Session } from './session';
import { useConnState, useRecovery } from './useSession';
import { useViewport } from './useViewport';

// App picks the screen from the connection's phase. All the rules live in
// src/net/; this only decides what to show.
function App({ session = getSession() }: { session?: Session }) {
  useViewport();
  const conn = useConnState(session);
  const recovery = useRecovery(session);
  const { phase, endReason } = conn;

  const inGame = phase === 'online' || phase === 'resuming' || phase === 'reconnecting';
  // The code is kept until the player confirms it, so a reload shows it again.
  if (recovery && inGame && !conn.staff) {
    return <RecoveryCode code={recovery} onConfirm={session.recovery.acknowledge} />;
  }
  if (inGame) return <Game session={session} conn={conn} />;

  if (phase === 'ended' && endReason && endReason !== 'bad_token') {
    return <Ended reason={endReason} message={conn.endMessage} onResume={session.conn.resume} />;
  }
  if (isStaffRoute()) return <StaffLogin conn={conn} onLogin={session.conn.login} />;
  const lostToken = phase === 'ended' && endReason === 'bad_token';
  return (
    <Landing
      key={lostToken ? 'lost' : 'new'}
      conn={conn}
      savedName={session.store.getName() ?? ''}
      notice={lostToken ? 'We could not find your session. Enter your recovery code to get your character back, or pick a new name.' : undefined}
      startInRecover={lostToken}
      onJoin={session.conn.join}
      onRecover={session.conn.recover}
    />
  );
}

export default App;
