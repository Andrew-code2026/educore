import React from "react";
import { AttendanceGradebook } from "./AttendanceGradebook";

/**
 * @deprecated Use AttendanceGradebook directly. The attendance sheet experience has been unified in Phase 7.
 */
export const AttendanceQuickRegister: React.FC<any> = (props) => {
  return <AttendanceGradebook {...props} />;
};

export default AttendanceQuickRegister;
